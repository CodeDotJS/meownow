import { afterEach, expect, test, vi } from "vitest";
import { deleteJson, getJson, postJson } from "./http";
import { resetTransportNoticeForTests, subscribeTransportNotice } from "./transport-notice";

afterEach(() => {
	vi.unstubAllGlobals();
	resetTransportNoticeForTests();
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

test("getJson publishes a transport notice from the response header", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			return new Response(JSON.stringify({ ok: true }), {
				headers: { "x-meownow-notice": "ipv6_unreachable" },
			});
		}),
	);
	const seen: Array<string | null> = [];
	const stop = subscribeTransportNotice((notice) => {
		seen.push(notice);
	});
	const res = await getJson("/api/items");
	expect(res.ok).toBe(true);
	expect(seen).toEqual([null, "ipv6_unreachable"]);
	stop();
});
