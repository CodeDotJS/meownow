import { expect, test } from "vitest";
import {
	itemExpiryResetResponseSchema,
	itemPreserveRequestSchema,
	itemPreserveResponseSchema,
	itemUpdateRequestSchema,
} from "./vault";

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

test("expiry reset returns a deadline and a count, not a per-item body", () => {
	const body = {
		ok: true as const,
		expiresAt: "2026-10-09T12:00:00.000Z",
		updated: 2,
	};
	expect(itemExpiryResetResponseSchema.parse(body)).toEqual(body);
	expect(
		itemExpiryResetResponseSchema.safeParse({ ok: true, expiresAt: body.expiresAt }).success,
	).toBe(false);
});

test("preserve is an enabled flag and nothing else", () => {
	expect(itemPreserveRequestSchema.parse({ enabled: true })).toEqual({ enabled: true });
	expect(itemPreserveRequestSchema.safeParse({ enabled: true, pinned: true }).success).toBe(false);
	expect(itemPreserveResponseSchema.parse({ ok: true, enabled: false })).toEqual({
		ok: true,
		enabled: false,
	});
});
