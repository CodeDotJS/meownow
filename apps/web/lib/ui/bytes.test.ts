import { describe, expect, test } from "vitest";
import { formatBytes } from "./bytes";

describe("formatBytes", () => {
	test("uses MB for the default grant", () => {
		expect(formatBytes(524_288_000)).toBe("500.0 MB");
	});
});
