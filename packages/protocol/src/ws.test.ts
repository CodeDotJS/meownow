import { expect, test } from "vitest";
import { mintHubTicket, openHubTicket } from "./ws";

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
