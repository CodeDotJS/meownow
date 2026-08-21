import { mintHubTicket } from "@meownow/protocol";
import { expect, test } from "vitest";
import { handleRequest } from "./http";

const secret = "0".repeat(32);
const app = "https://meownow.example";
const userId = "11111111-1111-4111-8111-111111111111";
const deviceId = "22222222-2222-4222-8222-222222222222";

function env(fanouts: unknown[]) {
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
		BLOBS: {},
		HUB_SECRET: secret,
		APP_URL: app,
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
