import { describe, expect, test } from "vitest";
import { deviceLabelFromHints } from "./device-label";

describe("deviceLabelFromHints", () => {
	test("names Safari on an iPhone", () => {
		expect(
			deviceLabelFromHints({
				userAgent:
					"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
				platform: "iPhone",
			}),
		).toBe("Safari on iPhone");
	});

	test("names Chrome on a Pixel from the UA model", () => {
		expect(
			deviceLabelFromHints({
				userAgent:
					"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
				platform: "Linux armv8l",
			}),
		).toBe("Chrome on Pixel 8");
	});

	test("prefers a client-hints model over a generic platform", () => {
		expect(
			deviceLabelFromHints({
				userAgent:
					"Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
				platform: "Linux armv8l",
				uaPlatform: "Android",
				uaModel: "Pixel 8 Pro",
				brands: [{ brand: "Chromium" }, { brand: "Google Chrome" }],
			}),
		).toBe("Chrome on Pixel 8 Pro");
	});

	test("names Chrome on a Mac", () => {
		expect(
			deviceLabelFromHints({
				userAgent:
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				platform: "MacIntel",
			}),
		).toBe("Chrome on Mac");
	});

	test("names Edge on Windows", () => {
		expect(
			deviceLabelFromHints({
				userAgent:
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
				platform: "Win32",
			}),
		).toBe("Edge on Windows");
	});

	test("stays inside the device-label cap", () => {
		expect(
			deviceLabelFromHints({
				userAgent: "Mozilla/5.0",
				uaModel: "x".repeat(80),
				brands: [{ brand: "Chrome" }],
			}).length,
		).toBeLessThanOrEqual(64);
	});
});
