import { describe, expect, test } from "vitest";
import { formatGutterTime, isLiveItem, ttlWarn } from "./time";

describe("formatGutterTime", () => {
	test("uses HH:MM for today", () => {
		const now = new Date(2026, 7, 22, 15, 0, 0).getTime();
		const iso = new Date(2026, 7, 22, 15, 2, 0).toISOString();
		expect(formatGutterTime(iso, now)).toBe("15:02");
	});

	test("uses MM-DD when not today", () => {
		const now = new Date(2026, 7, 22, 15, 0, 0).getTime();
		const iso = new Date(2026, 7, 21, 9, 32, 0).toISOString();
		expect(formatGutterTime(iso, now)).toBe("08-21");
	});
});

describe("isLiveItem", () => {
	test("keeps future expiries and drops past ones", () => {
		const now = Date.parse("2026-08-22T12:00:00.000Z");
		expect(isLiveItem("2026-08-22T12:00:01.000Z", now)).toBe(true);
		expect(isLiveItem("2026-08-22T12:00:00.000Z", now)).toBe(false);
		expect(isLiveItem("not-a-date", now)).toBe(false);
	});
});

describe("ttlWarn", () => {
	test("warns in the final three hours", () => {
		const now = Date.parse("2026-08-22T12:00:00.000Z");
		expect(ttlWarn("2026-08-22T14:30:00.000Z", now)).toBe(true);
		expect(ttlWarn("2026-08-23T12:00:00.000Z", now)).toBe(false);
	});
});
