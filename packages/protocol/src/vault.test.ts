import { expect, test } from "vitest";
import { itemUpdateRequestSchema } from "./vault";

test("item update is a new seal and cannot reset expiry", () => {
	const body = {
		kind: "text" as const,
		ciphertext: "Yg",
		metaCiphertext: "YQ",
		iv: "YQ",
		byteSize: 1,
	};
	expect(itemUpdateRequestSchema.parse(body)).toEqual(body);
	expect(
		itemUpdateRequestSchema.safeParse({
			...body,
			expiresAt: new Date().toISOString(),
		}).success,
	).toBe(false);
	expect(itemUpdateRequestSchema.safeParse({ ...body, kind: "file" }).success).toBe(false);
});
