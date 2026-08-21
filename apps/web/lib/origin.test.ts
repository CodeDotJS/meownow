import { expect, test } from "vitest";
import { originAllowed } from "./origin";

const appUrl = "https://meownow.example";

test("mutating requests require a matching Origin", () => {
	expect(originAllowed(new Request(appUrl, { method: "POST" }), appUrl)).toBe(false);
	expect(
		originAllowed(
			new Request(appUrl, { method: "POST", headers: { origin: "https://evil.example" } }),
			appUrl,
		),
	).toBe(false);
	expect(
		originAllowed(
			new Request(appUrl, { method: "POST", headers: { origin: "https://meownow.example" } }),
			appUrl,
		),
	).toBe(true);
});
