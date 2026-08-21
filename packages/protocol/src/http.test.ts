import { expect, test } from "vitest";
import {
	errorEnvelopeSchema,
	handleSchema,
	inviteCreateRequestSchema,
	registerOptionsRequestSchema,
} from "./http";

test("handle accepts lowercase tokens", () => {
	expect(handleSchema.parse("rishi")).toBe("rishi");
	expect(handleSchema.safeParse("Rishi").success).toBe(false);
	expect(handleSchema.safeParse("r").success).toBe(false);
});

test("register options require an invite token", () => {
	expect(
		registerOptionsRequestSchema.safeParse({
			handle: "ada",
			displayName: "Ada",
			deviceLabel: "laptop",
		}).success,
	).toBe(false);
});

test("error envelope is a code, not a message", () => {
	expect(errorEnvelopeSchema.parse({ error: "seats_full" }).error).toBe("seats_full");
	expect(errorEnvelopeSchema.safeParse({ error: "nope" }).success).toBe(false);
});

test("invite note is optional and capped", () => {
	expect(inviteCreateRequestSchema.parse({}).note).toBeUndefined();
	expect(inviteCreateRequestSchema.safeParse({ note: "x".repeat(121) }).success).toBe(false);
});
