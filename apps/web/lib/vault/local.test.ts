import { describe, expect, test } from "vitest";
import { isStaleLocalVault } from "./local";

describe("isStaleLocalVault", () => {
	test("drops local keys when the server has no vault", () => {
		expect(isStaleLocalVault(false, true)).toBe(true);
	});

	test("keeps local keys when the server vault exists", () => {
		expect(isStaleLocalVault(true, true)).toBe(false);
	});

	test("is a no-op when this browser is empty", () => {
		expect(isStaleLocalVault(false, false)).toBe(false);
		expect(isStaleLocalVault(true, false)).toBe(false);
	});
});
