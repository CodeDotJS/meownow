import { describe, expect, test } from "vitest";
import { preferRememberedPasskey, shouldForgetPasskey, waitForSession } from "./passkey";

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

describe("shouldForgetPasskey", () => {
	test("drops a remembered passkey after a failed assertion, not on rate limits", () => {
		expect(shouldForgetPasskey("unverified")).toBe(true);
		expect(shouldForgetPasskey("device_revoked")).toBe(true);
		expect(shouldForgetPasskey("rate_limited")).toBe(false);
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
