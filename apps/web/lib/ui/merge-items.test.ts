import { expect, test } from "vitest";
import { mergeRemoteItems } from "./merge-items";

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

test("keeps an ephemeral note that the server never stored", () => {
	const merged = mergeRemoteItems(
		[{ id: "lan", createdAt: "2026-08-22T12:00:00.000Z", ephemeral: true }],
		[],
		{ tombstones: [], pending: [] },
	);
	expect(merged.map((row) => row.id)).toEqual(["lan"]);
});
