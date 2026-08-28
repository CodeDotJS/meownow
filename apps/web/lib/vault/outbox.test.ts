import { itemCreateRequestSchema, itemUpdateRequestSchema } from "@meownow/protocol";
import { expect, test } from "vitest";
import {
	type CachedItem,
	drop,
	dropExpired,
	markSynced,
	releaseHeld,
	shouldAutoFlush,
	toCreatePayload,
	toUpdatePayload,
	unsynced,
} from "./outbox";

const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const idC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function item(over: Partial<CachedItem> & Pick<CachedItem, "id">): CachedItem {
	return {
		kind: "text",
		ciphertext: "YQ",
		metaCiphertext: "YQ",
		iv: "YQ",
		byteSize: 1,
		createdAt: "2026-08-25T12:00:00.000Z",
		expiresAt: "2026-09-24T12:00:00.000Z",
		state: "queued",
		...over,
	};
}

test("unsynced is queued, held, and dirty, newest first", () => {
	const rows = [
		item({ id: idA, state: "synced", createdAt: "2026-08-25T12:00:03.000Z" }),
		item({ id: idB, state: "held", createdAt: "2026-08-25T12:00:01.000Z" }),
		item({ id: idC, state: "queued", createdAt: "2026-08-25T12:00:02.000Z" }),
		item({
			id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
			state: "dirty",
			createdAt: "2026-08-25T12:00:04.000Z",
		}),
	];
	expect(unsynced(rows).map((row) => row.id)).toEqual([
		"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
		idC,
		idB,
	]);
});

test("auto-flush is queued or dirty notes while sync is on and online", () => {
	expect(shouldAutoFlush({ syncEnabled: true, online: true, state: "queued" })).toBe(true);
	expect(shouldAutoFlush({ syncEnabled: true, online: true, state: "dirty" })).toBe(true);
	expect(shouldAutoFlush({ syncEnabled: true, online: true, state: "held" })).toBe(false);
	expect(shouldAutoFlush({ syncEnabled: false, online: true, state: "queued" })).toBe(false);
	expect(shouldAutoFlush({ syncEnabled: true, online: false, state: "queued" })).toBe(false);
});

test("turning sync on releases held notes into the queue", () => {
	const rows = releaseHeld([
		item({ id: idA, state: "held" }),
		item({ id: idB, state: "queued" }),
		item({ id: idC, state: "synced" }),
	]);
	expect(rows.find((row) => row.id === idA)?.state).toBe("queued");
	expect(rows.find((row) => row.id === idB)?.state).toBe("queued");
	expect(rows.find((row) => row.id === idC)?.state).toBe("synced");
});

test("markSynced and drop target one id", () => {
	const rows = [item({ id: idA, state: "queued" }), item({ id: idB, state: "held" })];
	expect(markSynced(rows, idA).find((row) => row.id === idA)?.state).toBe("synced");
	expect(drop(rows, idB).map((row) => row.id)).toEqual([idA]);
});

test("dropExpired removes notes whose TTL has lapsed", () => {
	const now = new Date("2026-08-25T12:00:00.000Z");
	const rows = dropExpired(
		[
			item({ id: idA, expiresAt: "2026-08-25T11:00:00.000Z" }),
			item({ id: idB, expiresAt: "2026-08-25T13:00:00.000Z" }),
		],
		now,
	);
	expect(rows.map((row) => row.id)).toEqual([idB]);
});

test("create payload is the wire item, not cache metadata", () => {
	const row = item({ id: idA, kind: "link", createdAt: "2026-08-25T12:00:00.000Z" });
	const payload = toCreatePayload(row);
	expect(itemCreateRequestSchema.parse(payload)).toEqual({
		id: idA,
		kind: "link",
		ciphertext: "YQ",
		metaCiphertext: "YQ",
		iv: "YQ",
		byteSize: 1,
		expiresAt: row.expiresAt,
	});
	expect(payload).not.toHaveProperty("createdAt");
	expect(payload).not.toHaveProperty("state");
});

test("update payload is a new seal without id or expiry", () => {
	const row = item({ id: idA, kind: "link", state: "dirty" });
	const payload = toUpdatePayload(row);
	expect(itemUpdateRequestSchema.parse(payload)).toEqual({
		kind: "link",
		ciphertext: "YQ",
		metaCiphertext: "YQ",
		iv: "YQ",
		byteSize: 1,
	});
	expect(payload).not.toHaveProperty("id");
	expect(payload).not.toHaveProperty("expiresAt");
});
