import { DurableObject } from "cloudflare:workers";
import { parseEdgeEnv } from "@meownow/config/env";
import { wsEnvelopeSchema } from "@meownow/protocol";
import { handleRequest } from "./http";
import { HubRoom } from "./hub";

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
		_env: Env,
		_ctx: ExecutionContext,
	): Promise<void> {
		// M9: prune expired rows, orphaned R2 objects, uncommitted blobs older than 1 hour.
	},
};
