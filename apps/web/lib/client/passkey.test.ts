import { describe, expect, test } from "vitest";
import { preferRememberedPasskey, shouldRetryUsernameless, waitForSession } from "./passkey";

describe("preferRememberedPasskey", () => {
	test("leaves options alone when this browser has no remembered passkey", () => {
		const options = { challenge: "c", allowCredentials: undefined };
		expect(preferRememberedPasskey(options, null)).toEqual(options);
	});

	test("asks the authenticator for the passkey this browser already used", () => {
		expect(preferRememberedPasskey({ challenge: "c" }, "abc")).toEqual({
			challenge: "c",
			allowCredentials: [{ id: "abc", type: "public-key" }],
		});
	});
});

describe("shouldRetryUsernameless", () => {
	test("retries only when a remembered passkey was rejected", () => {
		expect(shouldRetryUsernameless("abc", "unverified")).toBe(true);
		expect(shouldRetryUsernameless("abc", "device_revoked")).toBe(true);
		expect(shouldRetryUsernameless("abc", "rate_limited")).toBe(false);
		expect(shouldRetryUsernameless(null, "unverified")).toBe(false);
	});
});

describe("waitForSession", () => {
	test("returns once the session cookie is visible", async () => {
		let n = 0;
		const ok = await waitForSession(
			async () => {
				n += 1;
				return n >= 3;
			},
			async () => undefined,
		);
		expect(ok).toBe(true);
		expect(n).toBe(3);
	});
});
