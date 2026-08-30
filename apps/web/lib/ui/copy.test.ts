import { errorCodeSchema } from "@meownow/protocol";
import { describe, expect, test } from "vitest";
import { notesSyncedCopy, statusCopy } from "./copy";

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
		expect(statusCopy("Downloaded.")).toBe("Downloaded.");
		expect(statusCopy("Request sent.")).toBe("Request sent.");
	});

	test("maps pairing and passkey failures", () => {
		expect(statusCopy("unverified")).toBe("That passkey did not work. Try again.");
		expect(statusCopy("passkey_failed")).toBe("Passkey was cancelled or failed.");
		expect(statusCopy("camera_denied")).toBe("Camera permission was denied.");
		expect(statusCopy("fingerprint mismatch")).toBe("Numbers did not match. Abort.");
		expect(statusCopy("vault_upload_failed")).toBe("Could not finish setup. Try again.");
		expect(statusCopy("vault_missing")).toBe(
			"This browser has no keys. Show a QR or use the 12 words.",
		);
		expect(statusCopy("wrap_failed")).toBe("Could not send keys to that device.");
		expect(statusCopy("scan_needs_signin")).toBe(
			"Sign in on this browser first. Add a device is only for a computer that already works.",
		);
		expect(statusCopy("ipv6_unreachable")).toBe(
			"IPv6 could not reach the database. Using IPv4 for now.",
		);
		expect(statusCopy("No Local peer.")).toBe("Stayed on this device. No other live device.");
		expect(statusCopy("dc_send_failed")).toBe("Stayed on this device. Could not send live.");
		expect(statusCopy("file_needs_network")).toBe("Need a network to send a file.");
		expect(statusCopy("file_needs_sync")).toBe(
			"Files need Sync on. They cannot wait on this browser.",
		);
		expect(statusCopy("sync_needs_network")).toBe("Need a network to sync.");
		expect(statusCopy("play_cap")).toBe("That's five. Forget one, or join with an invite.");
		expect(statusCopy("play_too_large")).toBe("That item is too large or empty.");
		expect(notesSyncedCopy(1)).toBe("1 note synced");
		expect(notesSyncedCopy(3)).toBe("3 notes synced");
	});

	test("does not dump raw JSON into the status pill", () => {
		expect(statusCopy('{"v":1,"id":"x"}')).toBe("Could not copy that.");
	});
});
