import { expect, test } from "vitest";
import { nextSessionExpiry, SESSION_HARD_CAP_MS, SESSION_SLIDING_MS } from "./sessions";

test("sliding window is 30 days and cannot pass the 90-day cap", () => {
	const created = new Date("2026-01-01T00:00:00.000Z");
	const day10 = new Date(created.getTime() + 10 * 24 * 60 * 60 * 1000);
	const sliding = nextSessionExpiry(created, day10);
	expect(sliding?.getTime()).toBe(day10.getTime() + SESSION_SLIDING_MS);

	const day80 = new Date(created.getTime() + 80 * 24 * 60 * 60 * 1000);
	const capped = nextSessionExpiry(created, day80);
	expect(capped?.getTime()).toBe(created.getTime() + SESSION_HARD_CAP_MS);
});

test("session past the hard cap is dead", () => {
	const created = new Date("2026-01-01T00:00:00.000Z");
	const day90 = new Date(created.getTime() + SESSION_HARD_CAP_MS);
	expect(nextSessionExpiry(created, day90)).toBeNull();
});
