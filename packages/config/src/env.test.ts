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

test("webEnv accepts DATABASE_URL and APP_URL", () => {
	const result = webEnvSchema.parse({
		DATABASE_URL: "postgresql://user:pass@localhost:5432/meownow",
		APP_URL: "https://meownow.example",
	});
	expect(result.APP_URL).toBe("https://meownow.example");
});

test("edgeEnv accepts Worker binding names without process.env", () => {
	const result = edgeEnvSchema.parse({
		HUB: {},
		BLOBS: {},
	});
	expect(result.HUB).toBeDefined();
	expect(result.BLOBS).toBeDefined();
});
