import type { EdgeEnv } from "@meownow/config/env";
import { openHubTicket, wsEnvelopeSchema } from "@meownow/protocol";

export async function handleRequest(request: Request, env: EdgeEnv): Promise<Response> {
	const url = new URL(request.url);
	if (request.method === "GET" && url.pathname === "/") {
		return new Response("meownow-edge", { status: 200 });
	}
	if (url.pathname === "/ws") {
		return connectWs(request, env);
	}
	if (request.method === "POST" && url.pathname === "/fanout") {
		return fanout(request, env);
	}
	return new Response("not found", { status: 404 });
}

async function connectWs(request: Request, env: EdgeEnv): Promise<Response> {
	const origin = request.headers.get("origin");
	if (!origin || origin !== new URL(env.APP_URL).origin) {
		return new Response("invalid_origin", { status: 403 });
	}
	const url = new URL(request.url);
	const token = url.searchParams.get("ticket");
	if (!token) {
		return new Response("unauthorized", { status: 401 });
	}
	const ticket = await openHubTicket(env.HUB_SECRET, token);
	if (ticket?.purpose !== "ws" || !ticket.deviceId) {
		return new Response("unauthorized", { status: 401 });
	}
	const stub = (env.HUB as DurableObjectNamespace).get(
		(env.HUB as DurableObjectNamespace).idFromName(ticket.userId),
	);
	const connect = new URL(request.url);
	connect.pathname = "/connect";
	connect.search = `deviceId=${encodeURIComponent(ticket.deviceId)}`;
	return stub.fetch(new Request(connect, request));
}

async function fanout(request: Request, env: EdgeEnv): Promise<Response> {
	const header = request.headers.get("authorization") ?? "";
	const token = header.startsWith("Bearer ") ? header.slice(7) : "";
	const ticket = await openHubTicket(env.HUB_SECRET, token);
	if (ticket?.purpose !== "fanout") {
		return new Response("unauthorized", { status: 401 });
	}
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return new Response("invalid_body", { status: 400 });
	}
	const parsed = wsEnvelopeSchema.safeParse(raw);
	if (!parsed.success) {
		return new Response("invalid_body", { status: 400 });
	}
	const stub = (env.HUB as DurableObjectNamespace).get(
		(env.HUB as DurableObjectNamespace).idFromName(ticket.userId),
	);
	return stub.fetch(
		new Request("https://hub/fanout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(parsed.data),
		}),
	);
}
