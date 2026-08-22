import { describe, expect, test } from "vitest";
import { OFFLINE_POLL_MS, shouldHttpPoll } from "./reconcile";

describe("shouldHttpPoll", () => {
	test("does not poll HTTP while the hub is live", () => {
		expect(shouldHttpPoll({ live: true, visible: true })).toBe(false);
	});

	test("polls only while the tab is visible and the hub is down", () => {
		expect(shouldHttpPoll({ live: false, visible: true })).toBe(true);
		expect(shouldHttpPoll({ live: false, visible: false })).toBe(false);
	});

	test("offline poll is a backoff, not a 4s tight loop", () => {
		expect(OFFLINE_POLL_MS).toBeGreaterThanOrEqual(15_000);
	});
});
