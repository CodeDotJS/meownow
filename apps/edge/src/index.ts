import { DurableObject } from "cloudflare:workers";
import { parseEdgeEnv } from "@meownow/config/env";
import { handleRequest } from "./http";

export interface Env {
	HUB: DurableObjectNamespace;
	BLOBS: R2Bucket;
}

export class HubDO extends DurableObject<Env> {
	override async fetch(request: Request): Promise<Response> {
		return handleRequest(request);
	}

	// M4 will call this.ctx.acceptWebSocket(server) so idle sockets hibernate.
	override async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): Promise<void> {}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		parseEdgeEnv(env);
		return handleRequest(request);
	},

	async scheduled(
		_controller: ScheduledController,
		_env: Env,
		_ctx: ExecutionContext,
	): Promise<void> {
		// M9: prune expired rows, orphaned R2 objects, uncommitted blobs older than 1 hour.
	},
};
