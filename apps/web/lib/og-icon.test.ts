import { expect, test } from "vitest";
import { publicPngDataUri } from "./og-icon";

test("reads the cat icon from the web public dir", () => {
	const uri = publicPngDataUri("icons/icon-192.png");
	expect(uri.startsWith("data:image/png;base64,")).toBe(true);
	expect(uri.length).toBeGreaterThan(100);
});
