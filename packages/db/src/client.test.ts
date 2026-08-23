import { neonConfig } from "@neondatabase/serverless";
import { afterEach, expect, test } from "vitest";
import {
	createHttpDb,
	neonTransportNotice,
	resetNeonTransportForTests,
	websocketConstructor,
	withDb,
} from "./client";

const previous = neonConfig.webSocketConstructor;

afterEach(() => {
	neonConfig.webSocketConstructor = previous;
	resetNeonTransportForTests();
});

test("createHttpDb returns a drizzle client without opening a pool", () => {
	const db = createHttpDb("postgresql://user:pass@localhost:5432/meownow");
	expect(db.query).toBeTypeOf("object");
});

test("createHttpDb reuses the same client for the same connection string", () => {
	const url = "postgresql://user:pass@localhost:5432/meownow-cache";
	expect(createHttpDb(url)).toBe(createHttpDb(url));
});

test("websocketConstructor prefers the platform WebSocket when present", () => {
	expect(websocketConstructor()).toBe(globalThis.WebSocket);
});

test("withDb retries once on a connect timeout and then uses IPv4", async () => {
	let attempts = 0;
	const result = await withDb("postgresql://user:pass@localhost:5432/retry", async () => {
		attempts += 1;
		if (attempts === 1) {
			throw Object.assign(new Error("Error connecting to database"), {
				cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
			});
		}
		return "ok";
	});
	expect(result).toBe("ok");
	expect(attempts).toBe(2);
	expect(neonTransportNotice()).toBe("ipv6_unreachable");
});

test("withDb does not retry a query error", async () => {
	let attempts = 0;
	await expect(
		withDb("postgresql://user:pass@localhost:5432/query-error", async () => {
			attempts += 1;
			throw Object.assign(new Error("duplicate key"), { code: "23505" });
		}),
	).rejects.toThrow("duplicate key");
	expect(attempts).toBe(1);
	expect(neonTransportNotice()).toBeNull();
});

test("withDb does not retry again after IPv4 is already in use", async () => {
	let first = 0;
	await withDb("postgresql://user:pass@localhost:5432/already-v4", async () => {
		first += 1;
		if (first === 1) {
			throw Object.assign(new Error("Error connecting to database"), {
				cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
			});
		}
		return "ok";
	});
	let later = 0;
	await expect(
		withDb("postgresql://user:pass@localhost:5432/already-v4", async () => {
			later += 1;
			throw Object.assign(new Error("Error connecting to database"), {
				cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
			});
		}),
	).rejects.toThrow("Error connecting to database");
	expect(later).toBe(1);
});
