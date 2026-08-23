import { expect, test } from "vitest";
import { HUB_PING, HUB_PONG, mintHubTicket, openHubTicket, wsEnvelopeSchema } from "./ws";

test("item.created can mark a live ephemeral note that was never stored", () => {
	const parsed = wsEnvelopeSchema.parse({
		v: 1,
		type: "item.created",
		ephemeral: true,
		item: {
			id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			kind: "text",
			ciphertext: "YQ",
			metaCiphertext: "YQ",
			iv: "YQ",
			byteSize: 1,
			expiresAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
		},
	});
	expect(parsed).toMatchObject({ type: "item.created", ephemeral: true });
});

test("keepalive frames parse and stay byte-exact for the edge auto-response", () => {
	expect(wsEnvelopeSchema.parse(JSON.parse(HUB_PING)).type).toBe("ping");
	expect(wsEnvelopeSchema.parse(JSON.parse(HUB_PONG)).type).toBe("pong");
	// setWebSocketAutoResponse matches on the exact string, so a re-serialised
	// frame must be identical to the constant the client sends.
	expect(JSON.stringify({ v: 1, type: "ping" })).toBe(HUB_PING);
	expect(JSON.stringify({ v: 1, type: "pong" })).toBe(HUB_PONG);
});

const secret = "0".repeat(32);

test("hub ticket roundtrips and rejects a wrong secret or expiry", async () => {
	const ticket = {
		v: 1 as const,
		purpose: "ws" as const,
		userId: "11111111-1111-4111-8111-111111111111",
		deviceId: "22222222-2222-4222-8222-222222222222",
		exp: Date.now() + 60_000,
	};
	const token = await mintHubTicket(secret, ticket);
	const opened = await openHubTicket(secret, token);
	expect(opened?.userId).toBe(ticket.userId);
	expect(await openHubTicket("1".repeat(32), token)).toBeNull();
	expect(
		await openHubTicket(secret, await mintHubTicket(secret, { ...ticket, exp: Date.now() - 1 })),
	).toBeNull();
});
