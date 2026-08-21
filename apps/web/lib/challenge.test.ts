import { expect, test } from "vitest";
import { challengeExpiry, openChallenge, sealChallenge } from "./challenge";

const secret = "0".repeat(32);
const now = new Date("2026-08-22T00:00:00.000Z");

test("sealed challenge roundtrips", () => {
	const payload = {
		v: 1 as const,
		purpose: "login" as const,
		challenge: "abc",
		exp: challengeExpiry(now),
	};
	expect(openChallenge(sealChallenge(payload, secret), secret, now)).toEqual(payload);
});

test("tampered or expired challenge is rejected", () => {
	const sealed = sealChallenge(
		{ v: 1, purpose: "login", challenge: "abc", exp: challengeExpiry(now) },
		secret,
	);
	expect(openChallenge(`${sealed}x`, secret, now)).toBeNull();
	expect(openChallenge(sealed, "1".repeat(32), now)).toBeNull();
	expect(
		openChallenge(
			sealChallenge({ v: 1, purpose: "login", challenge: "abc", exp: now.getTime() }, secret),
			secret,
			now,
		),
	).toBeNull();
});
