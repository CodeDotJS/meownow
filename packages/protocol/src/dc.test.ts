import { expect, test } from "vitest";
import { dcEnvelopeSchema } from "./dc";

test("datachannel item is ciphertext and rejects a plaintext field", () => {
	const ok = dcEnvelopeSchema.parse({
		v: 1,
		type: "item",
		ephemeral: true,
		item: {
			id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			kind: "text",
			ciphertext: "YQ",
			metaCiphertext: "YQ",
			iv: "YQ",
			byteSize: 1,
			expiresAt: new Date().toISOString(),
		},
	});
	expect(ok.ephemeral).toBe(true);
	expect(
		dcEnvelopeSchema.safeParse({
			v: 1,
			type: "item",
			ephemeral: true,
			plaintext: "hello",
			item: ok.item,
		}).success,
	).toBe(false);
});

test("datachannel carries a delete so an ephemeral item can be revoked off-server", () => {
	const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	const gone = dcEnvelopeSchema.parse({ v: 1, type: "item.deleted", id });
	expect(gone).toEqual({ v: 1, type: "item.deleted", id });
	expect(dcEnvelopeSchema.safeParse({ v: 1, type: "item.deleted", id: "nope" }).success).toBe(
		false,
	);
	expect(
		dcEnvelopeSchema.safeParse({ v: 1, type: "item.deleted", id, plaintext: "hi" }).success,
	).toBe(false);
});

test("datachannel item.updated replaces ciphertext on the same id", () => {
	const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	const parsed = dcEnvelopeSchema.parse({
		v: 1,
		type: "item.updated",
		ephemeral: false,
		item: {
			id,
			kind: "text",
			ciphertext: "Yg",
			metaCiphertext: "YQ",
			iv: "YQ",
			byteSize: 1,
			expiresAt: new Date().toISOString(),
		},
	});
	expect(parsed).toMatchObject({ type: "item.updated", item: { id, ciphertext: "Yg" } });
	expect(
		dcEnvelopeSchema.safeParse({
			v: 1,
			type: "item.updated",
			ephemeral: false,
			plaintext: "hi",
			item: parsed.item,
		}).success,
	).toBe(false);
});
