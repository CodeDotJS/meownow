import { afterEach, expect, test, vi } from "vitest";
import { deleteJson, getJson, postJson } from "./http";

afterEach(() => {
	vi.unstubAllGlobals();
});

test("postJson returns request_failed when fetch cannot reach the server", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		}),
	);
	const res = await postJson("/api/items", { id: "x" });
	expect(res.ok).toBe(false);
	expect(res.status).toBe(0);
	expect(res.data).toEqual({ error: "request_failed" });
});

test("getJson returns request_failed when fetch cannot reach the server", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		}),
	);
	const res = await getJson("/api/items");
	expect(res.ok).toBe(false);
	expect(res.data).toEqual({ error: "request_failed" });
});

test("deleteJson returns request_failed when fetch cannot reach the server", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		}),
	);
	const res = await deleteJson("/api/items/x");
	expect(res.ok).toBe(false);
	expect(res.data).toEqual({ error: "request_failed" });
});
