import { describe, expect, test } from "vitest";
import { formatInviteLeft, type InviteRow, openInvites } from "./invite-list";

function row(partial: Partial<InviteRow>): InviteRow {
	return {
		id: "1461d919-aaaa-bbbb-cccc-dddddddddddd",
		note: "rishi",
		expiresAt: "2026-08-25T12:00:00.000Z",
		redeemedAt: null,
		revokedAt: null,
		createdAt: "2026-08-22T12:00:00.000Z",
		...partial,
	};
}

describe("openInvites", () => {
	const now = new Date("2026-08-22T12:00:00.000Z");

	test("drops revoked and redeemed rows so a dead id cannot linger", () => {
		const open = row({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
		const revoked = row({ revokedAt: "2026-08-22T11:00:00.000Z" });
		const redeemed = row({
			id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
			redeemedAt: "2026-08-22T11:00:00.000Z",
		});
		expect(openInvites([revoked, open, redeemed], now).map((invite) => invite.id)).toEqual([
			open.id,
		]);
	});

	test("drops expired rows", () => {
		expect(openInvites([row({ expiresAt: "2026-08-22T12:00:00.000Z" })], now)).toEqual([]);
	});
});

describe("formatInviteLeft", () => {
	const now = Date.parse("2026-08-22T12:00:00.000Z");

	test("speaks in days or hours, not a uuid", () => {
		expect(formatInviteLeft("2026-08-24T12:00:00.000Z", now)).toBe("2 days left");
		expect(formatInviteLeft("2026-08-22T18:00:00.000Z", now)).toBe("6 hours left");
	});
});
