import { errorCodeSchema } from "@meownow/protocol";
import { describe, expect, test } from "vitest";
import { statusCopy } from "./copy";

describe("statusCopy", () => {
	test("maps every protocol error to a sentence", () => {
		for (const code of errorCodeSchema.options) {
			const copy = statusCopy(code);
			expect(copy).not.toBe(code);
			expect(copy.includes("_")).toBe(false);
			expect(copy.length).toBeGreaterThan(8);
		}
	});

	test("passes through literal status lines", () => {
		expect(statusCopy("Copied.")).toBe("Copied.");
		expect(statusCopy("Request sent.")).toBe("Request sent.");
	});

	test("maps pairing and passkey failures", () => {
		expect(statusCopy("passkey_failed")).toBe("Passkey was cancelled or failed.");
		expect(statusCopy("camera_denied")).toBe("Camera permission was denied.");
		expect(statusCopy("fingerprint mismatch")).toBe("Numbers did not match. Abort.");
		expect(statusCopy("vault_upload_failed")).toBe("Could not finish setup. Try again.");
	});
});
