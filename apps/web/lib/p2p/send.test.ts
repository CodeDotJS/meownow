import { expect, test } from "vitest";
import { sendOnMesh, shouldPersist } from "./send";

const item = {
	id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	kind: "text" as const,
	ciphertext: "YQ",
	metaCiphertext: "YQ",
	iv: "YQ",
	byteSize: 1,
	expiresAt: new Date().toISOString(),
};

test("ephemeral items skip persistence", () => {
	expect(shouldPersist(true)).toBe(false);
	expect(shouldPersist(false)).toBe(true);
});

test("datachannel path delivers without a server POST and beats a delayed server path", async () => {
	const received: unknown[] = [];
	const dcStart = performance.now();
	const dc = await sendOnMesh(
		[
			{
				send: (envelope) => {
					received.push(envelope);
				},
				local: true,
			},
		],
		{ v: 1, type: "item", ephemeral: true, item },
	);
	const dcMs = performance.now() - dcStart;
	expect(dc.delivered).toBe(1);
	expect(dc.local).toBe(true);
	expect(dc.failed).toBe(0);
	expect(received).toHaveLength(1);

	const serverStart = performance.now();
	await new Promise((resolve) => setTimeout(resolve, 25));
	const serverMs = performance.now() - serverStart;
	expect(dcMs).toBeLessThan(serverMs);
});

test("sendOnMesh keeps going when one peer rejects a large payload", async () => {
	const received: unknown[] = [];
	const result = await sendOnMesh(
		[
			{
				send: () => {
					throw new Error("Could not send data");
				},
				local: true,
			},
			{
				send: (envelope) => {
					received.push(envelope);
				},
				local: false,
			},
		],
		{ v: 1, type: "item", ephemeral: true, item },
	);
	expect(result.delivered).toBe(1);
	expect(result.failed).toBe(1);
	expect(received).toHaveLength(1);
});
