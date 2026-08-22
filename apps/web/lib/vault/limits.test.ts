import { afterEach, expect, test, vi } from "vitest";
import { createHttpLimits } from "./limits";

afterEach(() => {
	vi.unstubAllEnvs();
});

test("unconfigured limits deny in production", async () => {
	vi.stubEnv("NODE_ENV", "production");
	const limits = createHttpLimits({});
	expect(await limits.take("auth", "aa".repeat(32))).toBe(false);
});

test("unconfigured limits allow in development", async () => {
	vi.stubEnv("NODE_ENV", "development");
	const limits = createHttpLimits({});
	expect(await limits.take("send", "11111111-1111-4111-8111-111111111111")).toBe(true);
});
