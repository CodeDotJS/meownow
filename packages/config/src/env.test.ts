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

test("webEnv treats VAPID keys as optional", () => {
	const result = webEnvSchema.parse({
		DATABASE_URL: "postgresql://user:pass@localhost:5432/meownow",
		APP_URL: "https://meownow.example",
		SESSION_SECRET: "0".repeat(32),
		ADMIN_ENROLL_SECRET: "0".repeat(16),
		VAPID_PUBLIC_KEY: "pub",
		VAPID_PRIVATE_KEY: "priv",
		VAPID_SUBJECT: "mailto:admin@example.com",
	});
	expect(result.VAPID_PUBLIC_KEY).toBe("pub");
});

test("edgeEnv requires a hub secret and app origin", () => {
	expect(edgeEnvSchema.safeParse({ HUB: {}, BLOBS: {} }).success).toBe(false);
	const result = edgeEnvSchema.parse({
		HUB: {},
		BLOBS: {},
		HUB_SECRET: "0".repeat(32),
		APP_URL: "https://meownow.example",
	});
	expect(result.APP_URL).toBe("https://meownow.example");
});
