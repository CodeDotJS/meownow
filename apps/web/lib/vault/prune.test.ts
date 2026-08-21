import { PENDING_BLOB_MAX_AGE_MS } from "@meownow/protocol";
import { expect, test } from "vitest";
import { planPrune, r2Prefix } from "./prune";

const now = Date.parse("2026-08-22T03:00:00.000Z");

test("prune deletes expired unpinned items and pending blobs older than an hour", () => {
	const plan = planPrune({
		now,
		items: [
			{
				id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
				pinned: false,
				expiresAt: now - 1,
				blobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
			},
			{
				id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
				pinned: true,
				expiresAt: now - 1,
				blobId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
			},
		],
		blobs: [
			{
				id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
				r2Key: "dead-blob",
				state: "committed",
				createdAt: now - 86_400_000,
				ownerId: "owner",
				byteSize: 12,
			},
			{
				id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
				r2Key: "pinned-blob",
				state: "committed",
				createdAt: now - 86_400_000,
				ownerId: "owner",
				byteSize: 8,
			},
			{
				id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
				r2Key: "pending-old",
				state: "pending",
				createdAt: now - PENDING_BLOB_MAX_AGE_MS,
				ownerId: "owner",
				byteSize: 4,
			},
		],
		pairings: [{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", expiresAt: now - 1 }],
		sessions: [{ key: "s1", expiresAt: now - 1 }],
	});
	expect(plan.deleteItemIds).toEqual(["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
	expect(plan.deleteR2Keys.sort()).toEqual(["dead-blob", "pending-old"]);
	expect(plan.keepR2Keys).toEqual(["pinned-blob"]);
	expect(plan.decrementUsage).toEqual([{ ownerId: "owner", bytes: 12 }]);
	expect(plan.deletePairingIds).toHaveLength(1);
	expect(plan.deleteSessionKeys).toEqual(["s1"]);
});

test("r2 object keys are grouped by the server-generated prefix", () => {
	expect(r2Prefix("dead-blob/0")).toBe("dead-blob");
	expect(r2Prefix("dead-blob")).toBe("dead-blob");
});
