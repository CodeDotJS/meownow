import { DurableObject } from "cloudflare:workers";
import { parseEdgeEnv } from "@meownow/config/env";
import {
	AUTH_LIMIT_USER_ID,
	HUB_LIMIT_TTL_MS,
	mintHubTicket,
	pruneResponseSchema,
	wsEnvelopeSchema,
} from "@meownow/protocol";
import { handleRequest } from "./http";
import { HubRoom } from "./hub";
import { sweepOrphans } from "./prune";
import { AUTH_LIMIT, SEND_LIMIT, type TokenBucket, takeToken } from "./rate-limit";

export interface Env {
	HUB: DurableObjectNamespace;
	BLOBS: R2Bucket;
	HUB_SECRET: string;
	APP_URL: string;
	CAPABILITY_TOKEN_PUBLIC_KEY?: string;
}

export class HubDO extends DurableObject<Env> {
	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/connect") {
			if (request.headers.get("Upgrade") !== "websocket") {
				return new Response("expected websocket", { status: 426 });
			}
			const deviceId = url.searchParams.get("deviceId") ?? "";
			const pair = new WebSocketPair();
			this.ctx.acceptWebSocket(pair[1]);
			pair[1].serializeAttachment({ deviceId });
			pair[1].send(JSON.stringify({ v: 1, type: "hello", deviceId }));
			this.broadcastPresence();
			return new Response(null, { status: 101, webSocket: pair[0] });
		}
		if (url.pathname === "/fanout" && request.method === "POST") {
			const parsed = wsEnvelopeSchema.safeParse(await request.json().catch(() => null));
			if (!parsed.success) {
				return new Response("invalid_body", { status: 400 });
			}
			this.room().broadcast(parsed.data);
			return new Response(null, { status: 204 });
		}
		if (url.pathname === "/limit" && request.method === "POST") {
			const raw = (await request.json().catch(() => null)) as { bucket?: string } | null;
			const name = raw?.bucket === "auth" ? "auth" : "send";
			const limit = name === "auth" ? AUTH_LIMIT : SEND_LIMIT;
			const stored = await this.ctx.storage.get<TokenBucket>(`bucket:${name}`);
			const result = takeToken(stored, Date.now(), limit);
			await this.ctx.storage.put(`bucket:${name}`, result.bucket);
			return new Response(null, { status: result.ok ? 204 : 429 });
		}
		return new Response("not found", { status: 404 });
	}

	override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const text = typeof message === "string" ? message : new TextDecoder().decode(message);
		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch {
			return;
		}
		const parsed = wsEnvelopeSchema.safeParse(raw);
		if (!parsed.success) {
			return;
		}
		const attachment = ws.deserializeAttachment() as { deviceId?: string } | null;
		if (
			(parsed.data.type === "rtc.offer" ||
				parsed.data.type === "rtc.answer" ||
				parsed.data.type === "rtc.ice") &&
			parsed.data.from !== attachment?.deviceId
		) {
			return;
		}
		this.room().route(parsed.data);
	}

	override async webSocketClose(ws: WebSocket): Promise<void> {
		this.broadcastPresence(ws);
	}

	private room(except?: WebSocket): HubRoom {
		const room = new HubRoom();
		for (const socket of this.ctx.getWebSockets()) {
			if (except && socket === except) {
				continue;
			}
			const attachment = socket.deserializeAttachment() as { deviceId?: string } | null;
			room.add({
				deviceId: attachment?.deviceId ?? "",
				send: (data) => socket.send(data),
			});
		}
		return room;
	}

	private broadcastPresence(except?: WebSocket): void {
		const room = this.room(except);
		room.broadcast({ v: 1, type: "presence.changed", devices: room.presence() });
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		return handleRequest(request, parseEdgeEnv(env));
	},

	async scheduled(
		_controller: ScheduledController,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<void> {
		await runCron(env);
	},
};

export async function runCron(env: Env): Promise<void> {
	const ticket = await mintHubTicket(env.HUB_SECRET, {
		v: 1,
		purpose: "cron",
		userId: AUTH_LIMIT_USER_ID,
		exp: Date.now() + HUB_LIMIT_TTL_MS,
	});
	const res = await fetch(`${env.APP_URL.replace(/\/$/, "")}/api/internal/prune`, {
		method: "POST",
		headers: { authorization: `Bearer ${ticket}` },
	});
	if (!res.ok) {
		return;
	}
	const parsed = pruneResponseSchema.safeParse(await res.json().catch(() => null));
	if (!parsed.success) {
		return;
	}
	await sweepOrphans(
		env.BLOBS as Parameters<typeof sweepOrphans>[0],
		new Set(parsed.data.keepR2Keys),
	);
}
