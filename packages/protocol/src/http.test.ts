import { expect, test } from "vitest";
import {
	errorEnvelopeSchema,
	handleSchema,
	inviteCreateRequestSchema,
	loginVerifyRequestSchema,
	publicKeyOptionsResponseSchema,
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

test("login options may echo the sealed challenge", () => {
	expect(publicKeyOptionsResponseSchema.parse({ options: {}, challenge: "sealed" }).challenge).toBe(
		"sealed",
	);
	expect(publicKeyOptionsResponseSchema.parse({ options: {} }).challenge).toBeUndefined();
});

test("login verify may send the sealed challenge in the body", () => {
	const credential = {
		id: "YQ",
		rawId: "YQ",
		type: "public-key" as const,
		response: {
			clientDataJSON: "e30",
			authenticatorData: "e30",
			signature: "e30",
		},
	};
	expect(loginVerifyRequestSchema.parse({ credential }).challenge).toBeUndefined();
	expect(loginVerifyRequestSchema.parse({ credential, challenge: "sealed" }).challenge).toBe(
		"sealed",
	);
});

test("invite note is optional and capped", () => {
	expect(inviteCreateRequestSchema.parse({}).note).toBeUndefined();
	expect(inviteCreateRequestSchema.safeParse({ note: "x".repeat(121) }).success).toBe(false);
});
