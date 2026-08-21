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
