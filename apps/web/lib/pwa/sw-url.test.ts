import { expect, test } from "vitest";
import { SW_PATH, SW_TRUSTED_TYPES_POLICY, swScriptUrl } from "./sw-url";

test("without Trusted Types the worker URL is the same-origin path", () => {
	expect(SW_PATH).toBe("/sw.js");
	expect(String(swScriptUrl())).toBe("/sw.js");
});

test("Trusted Types policy only mints /sw.js", () => {
	const g = globalThis as {
		trustedTypes?: {
			createPolicy: (
				name: string,
				rules: { createScriptURL: (url: string) => string },
			) => { createScriptURL: (url: string) => { toString(): string } };
		};
	};
	g.trustedTypes = {
		createPolicy(name, rules) {
			expect(name).toBe(SW_TRUSTED_TYPES_POLICY);
			expect(rules.createScriptURL(SW_PATH)).toBe(SW_PATH);
			expect(() => rules.createScriptURL("https://evil.example/sw.js")).toThrow(TypeError);
			return {
				createScriptURL(url: string) {
					return { toString: () => rules.createScriptURL(url) };
				},
			};
		},
	};
	try {
		expect(String(swScriptUrl())).toBe(SW_PATH);
	} finally {
		delete g.trustedTypes;
	}
});
