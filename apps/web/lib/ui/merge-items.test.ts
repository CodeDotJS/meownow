import { expect, test } from "vitest";
import { mergeRemoteItems, nextPendingIds } from "./merge-items";

test("keeps a just-sent note when an older fetch comes back first", () => {
	const pending = new Set(["new"]);
	const merged = mergeRemoteItems(
		[{ id: "new", createdAt: "2026-08-22T12:00:02.000Z" }],
		[{ id: "old", createdAt: "2026-08-22T11:00:00.000Z" }],
		{ tombstones: [], pending },
	);
	expect(merged.map((row) => row.id)).toEqual(["new", "old"]);
});

test("drops a forgotten note even if the server has not caught up", () => {
	const merged = mergeRemoteItems([], [{ id: "gone", createdAt: "2026-08-22T12:00:00.000Z" }], {
		tombstones: ["gone"],
		pending: [],
	});
	expect(merged).toEqual([]);
});

test("keeps three held notes the server has not seen, and a tombstone still wins", () => {
	const pending = new Set(["a", "b", "c"]);
	const merged = mergeRemoteItems(
		[
			{ id: "a", createdAt: "2026-08-25T12:00:03.000Z" },
			{ id: "b", createdAt: "2026-08-25T12:00:02.000Z" },
			{ id: "c", createdAt: "2026-08-25T12:00:01.000Z" },
			{ id: "gone", createdAt: "2026-08-25T11:00:00.000Z" },
		],
		[{ id: "old", createdAt: "2026-08-25T10:00:00.000Z" }],
		{ tombstones: ["gone"], pending },
	);
	expect(merged.map((row) => row.id)).toEqual(["a", "b", "c", "old"]);
});

test("a refresh keeps an in-flight upload that is still on screen", () => {
	const next = nextPendingIds(["uploading"], ["uploading", "old"], []);
	expect([...next]).toEqual(["uploading"]);
});

test("keeps an ephemeral note that the server never stored", () => {
	const merged = mergeRemoteItems(
		[{ id: "lan", createdAt: "2026-08-22T12:00:00.000Z", ephemeral: true }],
		[],
		{ tombstones: [], pending: [] },
	);
	expect(merged.map((row) => row.id)).toEqual(["lan"]);
});
