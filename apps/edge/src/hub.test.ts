import { expect, test } from "vitest";
import { HubRoom } from "./hub";

test("two subscribers receive the same item.created envelope", () => {
	const room = new HubRoom();
	const a: string[] = [];
	const b: string[] = [];
	room.add({ deviceId: "a", send: (data) => a.push(data) });
	room.add({ deviceId: "b", send: (data) => b.push(data) });
	const envelope = {
		v: 1 as const,
		type: "item.created" as const,
		item: {
			id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			kind: "text" as const,
			ciphertext: "YQ",
			metaCiphertext: "YQ",
			iv: "YQ",
			byteSize: 1,
			expiresAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
		},
	};
	expect(room.broadcast(envelope)).toBe(2);
	expect(a).toEqual(b);
	expect(JSON.parse(a[0] ?? "{}")).toMatchObject({
		type: "item.created",
		item: { id: envelope.item.id },
	});
});
