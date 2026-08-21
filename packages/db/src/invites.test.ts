import { expect, test } from "vitest";
import { INVITE_TTL_MS, inviteExpiresAt, inviteState } from "./invites";

const now = new Date("2026-08-22T00:00:00.000Z");

test("fresh invite is redeemable", () => {
	expect(
		inviteState({ expiresAt: inviteExpiresAt(now), revokedAt: null, redeemedAt: null }, now),
	).toBe("ok");
});

test("expired, revoked, and redeemed invites are not redeemable", () => {
	expect(
		inviteState({ expiresAt: new Date(now.getTime() - 1), revokedAt: null, redeemedAt: null }, now),
	).toBe("expired");
	expect(
		inviteState({ expiresAt: inviteExpiresAt(now), revokedAt: now, redeemedAt: null }, now),
	).toBe("revoked");
	expect(
		inviteState({ expiresAt: inviteExpiresAt(now), revokedAt: null, redeemedAt: now }, now),
	).toBe("redeemed");
	expect(inviteState(null, now)).toBe("missing");
});

test("invite ttl is 72 hours", () => {
	expect(INVITE_TTL_MS).toBe(72 * 60 * 60 * 1000);
	expect(inviteExpiresAt(now).getTime() - now.getTime()).toBe(INVITE_TTL_MS);
});
