import { expect, test } from "vitest";
import { dbEnvSchema, edgeEnvSchema, webEnvSchema } from "./env";

test("dbEnv rejects missing DATABASE_URL", () => {
	const result = dbEnvSchema.safeParse({});
	expect(result.success).toBe(false);
});

test("dbEnv accepts a postgresql URL", () => {
	const result = dbEnvSchema.parse({
		DATABASE_URL: "postgresql://user:pass@localhost:5432/meownow",
	});
	expect(result.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/meownow");
});

test("webEnv requires APP_URL", () => {
	const result = webEnvSchema.safeParse({
		DATABASE_URL: "postgresql://user:pass@localhost:5432/meownow",
	});
	expect(result.success).toBe(false);
});

test("webEnv requires session and admin-enroll secrets", () => {
	const result = webEnvSchema.safeParse({
		DATABASE_URL: "postgresql://user:pass@localhost:5432/meownow",
		APP_URL: "https://meownow.example",
	});
	expect(result.success).toBe(false);
});

test("webEnv accepts DATABASE_URL, APP_URL, and auth secrets", () => {
	const result = webEnvSchema.parse({
		DATABASE_URL: "postgresql://user:pass@localhost:5432/meownow",
		APP_URL: "https://meownow.example",
		SESSION_SECRET: "0".repeat(32),
		ADMIN_ENROLL_SECRET: "0".repeat(16),
	});
	expect(result.APP_URL).toBe("https://meownow.example");
	expect(result.SESSION_SECRET).toHaveLength(32);
});

test("edgeEnv accepts Worker binding names without process.env", () => {
	const result = edgeEnvSchema.parse({
		HUB: {},
		BLOBS: {},
	});
	expect(result.HUB).toBeDefined();
	expect(result.BLOBS).toBeDefined();
});
