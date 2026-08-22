import { generateCapabilityKeyPair, mintCapabilityToken, mintHubTicket } from "@meownow/protocol";
import { expect, test } from "vitest";
import { handleRequest } from "./http";

const secret = "0".repeat(32);
const app = "https://meownow.example";
const userId = "11111111-1111-4111-8111-111111111111";
const deviceId = "22222222-2222-4222-8222-222222222222";

function env(fanouts: unknown[], blobs?: ReturnType<typeof memoryR2> & { publicJwk?: JsonWebKey }) {
	return {
		HUB: {
			idFromName: () => "id",
			get: () => ({
				fetch: async (request: Request) => {
					if (request.method === "POST") {
						fanouts.push(await request.json());
					}
					return new Response(null, { status: 204 });
				},
			}),
		},
		BLOBS: blobs ?? memoryR2(),
		HUB_SECRET: secret,
		APP_URL: app,
		CAPABILITY_TOKEN_PUBLIC_KEY: blobs?.publicJwk ? JSON.stringify(blobs.publicJwk) : undefined,
	};
}

function memoryR2() {
	const store = new Map<string, Uint8Array>();
	const puts: string[] = [];
	return {
		store,
		puts,
		async put(key: string, value: ReadableStream | ArrayBuffer | string | null) {
			puts.push(key);
			const bytes = new Uint8Array(await new Response(value ?? "").arrayBuffer());
			store.set(key, bytes);
		},
		async get(key: string) {
			const body = store.get(key);
			if (!body) {
				return null;
			}
			return { body: body, size: body.byteLength };
		},
		async list(input: { prefix: string }) {
			const objects = [...store.entries()]
				.filter(([key]) => key.startsWith(input.prefix))
				.map(([key, value]) => ({ key, size: value.byteLength }));
			return { objects };
		},
	};
}

test("GET / returns 200 and meownow-edge", async () => {
	const response = await handleRequest(new Request("https://edge.meownow.test/"), env([]));
	expect(response.status).toBe(200);
	expect(await response.text()).toBe("meownow-edge");
});

test("fanout without a ticket is denied", async () => {
	const response = await handleRequest(
		new Request("https://edge.meownow.test/fanout", {
			method: "POST",
			body: "{}",
		}),
		env([]),
	);
	expect(response.status).toBe(401);
});

test("ticketed fanout reaches the durable object", async () => {
	const fanouts: unknown[] = [];
	const token = await mintHubTicket(secret, {
		v: 1,
		purpose: "fanout",
		userId,
		exp: Date.now() + 30_000,
	});
	const envelope = {
		v: 1,
		type: "item.deleted",
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	};
	const response = await handleRequest(
		new Request("https://edge.meownow.test/fanout", {
			method: "POST",
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: JSON.stringify(envelope),
		}),
		env(fanouts),
	);
	expect(response.status).toBe(204);
	expect(fanouts).toEqual([envelope]);
});

test("websocket connect without origin is denied", async () => {
	const token = await mintHubTicket(secret, {
		v: 1,
		purpose: "ws",
		userId,
		deviceId,
		exp: Date.now() + 60_000,
	});
	const response = await handleRequest(
		new Request(`https://edge.meownow.test/ws?ticket=${token}`),
		env([]),
	);
	expect(response.status).toBe(403);
});

test("upload without a capability token never writes to R2", async () => {
	const blobs = memoryR2();
	const response = await handleRequest(
		new Request("https://edge.meownow.test/upload?chunk=0", {
			method: "PUT",
			headers: { "content-length": "4" },
			body: new Uint8Array([1, 2, 3, 4]),
		}),
		env([], blobs),
	);
	expect(response.status).toBe(401);
	expect(blobs.puts).toEqual([]);
});

test("upload with a valid token writes ciphertext under the server key", async () => {
	const keys = await generateCapabilityKeyPair();
	const blobs = Object.assign(memoryR2(), { publicJwk: keys.publicJwk });
	const r2Key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	const jwt = await mintCapabilityToken(keys.privateJwk, {
		v: 1,
		purpose: "upload",
		userId,
		key: r2Key,
		maxBytes: 1024,
		blobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		exp: Math.floor(Date.now() / 1000) + 60,
	});
	const response = await handleRequest(
		new Request("https://edge.meownow.test/upload?chunk=0", {
			method: "PUT",
			headers: { authorization: `Bearer ${jwt}`, "content-length": "3" },
			body: new Uint8Array([9, 8, 7]),
		}),
		env([], blobs),
	);
	expect(response.status).toBe(204);
	expect(blobs.puts).toEqual([`${r2Key}/0`]);
});

test("upload over the token byte cap is rejected", async () => {
	const keys = await generateCapabilityKeyPair();
	const blobs = Object.assign(memoryR2(), { publicJwk: keys.publicJwk });
	const jwt = await mintCapabilityToken(keys.privateJwk, {
		v: 1,
		purpose: "upload",
		userId,
		key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		maxBytes: 4,
		blobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		exp: Math.floor(Date.now() / 1000) + 60,
	});
	const response = await handleRequest(
		new Request("https://edge.meownow.test/upload?chunk=0", {
			method: "PUT",
			headers: { authorization: `Bearer ${jwt}`, "content-length": "8" },
			body: new Uint8Array(8),
		}),
		env([], blobs),
	);
	expect(response.status).toBe(413);
	expect(blobs.puts).toEqual([]);
});

test("ticketed limit forwards the hashed key to the durable object", async () => {
	const fanouts: unknown[] = [];
	const token = await mintHubTicket(secret, {
		v: 1,
		purpose: "limit",
		userId,
		exp: Date.now() + 30_000,
	});
	const body = { bucket: "auth", key: "ab".repeat(32) };
	const response = await handleRequest(
		new Request("https://edge.meownow.test/limit", {
			method: "POST",
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
		env(fanouts),
	);
	expect(response.status).toBe(204);
	expect(fanouts).toEqual([body]);
});

test("limit without a ticket is denied", async () => {
	const response = await handleRequest(
		new Request("https://edge.meownow.test/limit", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ bucket: "send" }),
		}),
		env([]),
	);
	expect(response.status).toBe(401);
});
