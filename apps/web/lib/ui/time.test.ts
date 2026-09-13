import { describe, expect, test } from "vitest";
import {
	formatClockTime,
	formatDayLabel,
	formatGutterTime,
	groupByDay,
	isLiveItem,
	ttlWarn,
} from "./time";

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

describe("formatDayLabel", () => {
	test("names today and yesterday, then the calendar day", () => {
		const now = new Date(2026, 7, 24, 15, 0, 0).getTime();
		expect(formatDayLabel(new Date(2026, 7, 24, 9, 12).toISOString(), now)).toEqual({
			key: "2026-08-24",
			title: "Today",
			date: "24 August",
		});
		expect(formatDayLabel(new Date(2026, 7, 23, 22, 10).toISOString(), now)).toEqual({
			key: "2026-08-23",
			title: "Yesterday",
			date: "23 August",
		});
		expect(formatDayLabel(new Date(2026, 7, 21, 8, 0).toISOString(), now)).toEqual({
			key: "2026-08-21",
			title: "21 August",
			date: "",
		});
	});
});

describe("groupByDay", () => {
	test("keeps newest-first items under each day", () => {
		const now = new Date(2026, 7, 24, 18, 0, 0).getTime();
		const groups = groupByDay(
			[
				{ id: "a", createdAt: new Date(2026, 7, 24, 14, 32).toISOString() },
				{ id: "b", createdAt: new Date(2026, 7, 24, 11, 5).toISOString() },
				{ id: "c", createdAt: new Date(2026, 7, 23, 22, 10).toISOString() },
			],
			now,
		);
		expect(groups.map((group) => group.key)).toEqual(["2026-08-24", "2026-08-23"]);
		expect(groups[0]?.items.map((item) => item.id)).toEqual(["a", "b"]);
		expect(formatClockTime(groups[0]?.items[0]?.createdAt ?? "")).toBe("14:32");
	});
});

describe("isLiveItem", () => {
	test("keeps future expiries and drops past ones", () => {
		const now = Date.parse("2026-08-22T12:00:00.000Z");
		expect(isLiveItem("2026-08-22T12:00:01.000Z", now)).toBe(true);
		expect(isLiveItem("2026-08-22T12:00:00.000Z", now)).toBe(false);
		expect(isLiveItem("not-a-date", now)).toBe(false);
		expect(isLiveItem("2026-08-22T12:00:00.000Z", now, true)).toBe(true);
	});
});

describe("ttlWarn", () => {
	test("warns in the final three hours", () => {
		const now = Date.parse("2026-08-22T12:00:00.000Z");
		expect(ttlWarn("2026-08-22T14:30:00.000Z", now)).toBe(true);
		expect(ttlWarn("2026-08-23T12:00:00.000Z", now)).toBe(false);
	});
});
