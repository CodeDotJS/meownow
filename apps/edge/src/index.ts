import { DurableObject } from "cloudflare:workers";
import { parseEdgeEnv } from "@meownow/config/env";
import { wsEnvelopeSchema } from "@meownow/protocol";
import { handleRequest } from "./http";

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
			return new Response(null, { status: 101, webSocket: pair[0] });
		}
		if (url.pathname === "/fanout" && request.method === "POST") {
			const parsed = wsEnvelopeSchema.safeParse(await request.json().catch(() => null));
			if (!parsed.success) {
				return new Response("invalid_body", { status: 400 });
			}
			const payload = JSON.stringify(parsed.data);
			for (const socket of this.ctx.getWebSockets()) {
				socket.send(payload);
			}
			return new Response(null, { status: 204 });
		}
		return new Response("not found", { status: 404 });
	}

	override async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): Promise<void> {}
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
