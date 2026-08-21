import type { EdgeEnv } from "@meownow/config/env";
import {
	MAX_CHUNK_CIPHER_BYTES,
	openCapabilityToken,
	openHubTicket,
	parseCapabilityJwk,
	wsEnvelopeSchema,
} from "@meownow/protocol";

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
	if (url.pathname === "/upload") {
		return upload(request, env);
	}
	if (request.method === "GET" && url.pathname === "/stat") {
		return stat(request, env);
	}
	if (request.method === "GET" && url.pathname === "/dl") {
		return download(request, env);
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

async function upload(request: Request, env: EdgeEnv): Promise<Response> {
	if (request.method !== "PUT") {
		return new Response("not found", { status: 404 });
	}
	const token = await requireCapability(request, env, "upload");
	if (token instanceof Response) {
		return token;
	}
	const lengthHeader = request.headers.get("content-length");
	if (!lengthHeader) {
		return new Response("length_required", { status: 411 });
	}
	const length = Number(lengthHeader);
	if (!Number.isInteger(length) || length <= 0) {
		return new Response("item_invalid", { status: 400 });
	}
	if (length > token.maxBytes || length > MAX_CHUNK_CIPHER_BYTES) {
		return new Response("too_large", { status: 413 });
	}
	const chunk = new URL(request.url).searchParams.get("chunk");
	if (!chunk || !isChunkName(chunk)) {
		return new Response("item_invalid", { status: 400 });
	}
	const bucket = env.BLOBS as R2Bucket;
	await bucket.put(`${token.key}/${chunk}`, request.body, {
		httpMetadata: { contentType: "application/octet-stream" },
	});
	return new Response(null, { status: 204 });
}

async function stat(request: Request, env: EdgeEnv): Promise<Response> {
	const token = await requireCapability(request, env, "stat");
	if (token instanceof Response) {
		return token;
	}
	const listed = await (env.BLOBS as R2Bucket).list({ prefix: `${token.key}/` });
	let bytes = 0;
	for (const object of listed.objects) {
		bytes += object.size;
	}
	return Response.json({ bytes, count: listed.objects.length });
}

async function download(request: Request, env: EdgeEnv): Promise<Response> {
	const token = await requireCapability(request, env, "download");
	if (token instanceof Response) {
		return token;
	}
	const chunk = new URL(request.url).searchParams.get("chunk");
	if (!chunk || !isChunkName(chunk)) {
		return new Response("item_invalid", { status: 400 });
	}
	const object = await (env.BLOBS as R2Bucket).get(`${token.key}/${chunk}`);
	if (!object) {
		return new Response("not found", { status: 404 });
	}
	return new Response(object.body, {
		status: 200,
		headers: {
			"content-type": "application/octet-stream",
			"content-disposition": "attachment",
			"x-content-type-options": "nosniff",
		},
	});
}

async function requireCapability(
	request: Request,
	env: EdgeEnv,
	purpose: "upload" | "stat" | "download",
) {
	if (!env.CAPABILITY_TOKEN_PUBLIC_KEY) {
		return new Response("unauthorized", { status: 401 });
	}
	const header = request.headers.get("authorization") ?? "";
	const jwt = header.startsWith("Bearer ") ? header.slice(7) : "";
	if (!jwt) {
		return new Response("unauthorized", { status: 401 });
	}
	let publicJwk: JsonWebKey;
	try {
		publicJwk = parseCapabilityJwk(env.CAPABILITY_TOKEN_PUBLIC_KEY);
	} catch {
		return new Response("unauthorized", { status: 401 });
	}
	const token = await openCapabilityToken(publicJwk, jwt);
	if (!token || token.purpose !== purpose) {
		return new Response("unauthorized", { status: 401 });
	}
	return token;
}

function isChunkName(value: string): boolean {
	if (value === "trailer") {
		return true;
	}
	if (!/^\d+$/.test(value)) {
		return false;
	}
	const n = Number(value);
	return n >= 0 && n < 1024;
}
