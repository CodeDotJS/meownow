import { expect, test } from "vitest";
import { safeHref } from "./markdown-href";

test("allows absolute http(s) and mailto", () => {
	expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
	expect(safeHref("http://example.com")).toBe("http://example.com/");
	expect(safeHref("mailto:a@example.com")).toBe("mailto:a@example.com");
});

test("drops javascript, data, and relative hrefs", () => {
	expect(safeHref("javascript:alert(1)")).toBeNull();
	expect(safeHref("data:text/html,hi")).toBeNull();
	expect(safeHref("/admin")).toBeNull();
	expect(safeHref("//evil.example")).toBeNull();
	expect(safeHref("")).toBeNull();
	expect(safeHref("mailto:")).toBeNull();
});
