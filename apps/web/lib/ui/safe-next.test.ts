import { expect, test } from "vitest";
import { safeNextPath } from "./safe-next";

test("safeNextPath keeps in-app paths and drops open redirects", () => {
	expect(safeNextPath("/pair/scan")).toBe("/pair/scan");
	expect(safeNextPath("/")).toBe("/");
	expect(safeNextPath(null)).toBe("/");
	expect(safeNextPath("//evil.example")).toBe("/");
	expect(safeNextPath("https://evil.example")).toBe("/");
	expect(safeNextPath("\\pair\\scan")).toBe("/");
});
