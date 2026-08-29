import { expect, test } from "vitest";
import {
	asItemCacheMeta,
	DEFAULT_ITEM_CACHE_META,
	type ItemCacheMeta,
	type ItemCacheStore,
} from "./item-cache";
import type { CachedItem } from "./outbox";

const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function sample(over: Partial<CachedItem> = {}): CachedItem {
	return {
		id: idA,
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

class MemoryItemCache implements ItemCacheStore {
	private meta: ItemCacheMeta = { ...DEFAULT_ITEM_CACHE_META };
	private records = new Map<string, CachedItem>();

	async getMeta(): Promise<ItemCacheMeta> {
		return this.meta;
	}

	async setMeta(meta: ItemCacheMeta): Promise<void> {
		this.meta = meta;
	}

	async put(item: CachedItem): Promise<void> {
		this.records.set(item.id, item);
	}

	async getAll(): Promise<CachedItem[]> {
		return [...this.records.values()];
	}

	async delete(id: string): Promise<void> {
		this.records.delete(id);
	}

	async clear(): Promise<void> {
		this.meta = { ...DEFAULT_ITEM_CACHE_META };
		this.records.clear();
	}
}

test("sync is on until this browser turns it off", async () => {
	const cache = new MemoryItemCache();
	expect((await cache.getMeta()).syncEnabled).toBe(true);
	expect(DEFAULT_ITEM_CACHE_META.syncEnabled).toBe(true);
});

test("lastMe round-trips", async () => {
	const cache = new MemoryItemCache();
	const lastMe = {
		id: idA,
		handle: "rishi",
		displayName: "Rishi",
		role: "admin" as const,
		canUpload: true,
		hasVault: true,
	};
	await cache.setMeta({ ...DEFAULT_ITEM_CACHE_META, syncEnabled: false, lastMe });
	expect(await cache.getMeta()).toEqual({
		...DEFAULT_ITEM_CACHE_META,
		syncEnabled: false,
		lastMe,
	});
});

test("put, list, delete, and clear", async () => {
	const cache = new MemoryItemCache();
	await cache.put(sample());
	expect((await cache.getAll()).map((row) => row.id)).toEqual([idA]);
	await cache.delete(idA);
	expect(await cache.getAll()).toEqual([]);
	await cache.put(sample());
	await cache.setMeta({
		...DEFAULT_ITEM_CACHE_META,
		syncEnabled: false,
		lastMe: {
			id: idA,
			handle: "rishi",
			displayName: "Rishi",
			role: "member",
			canUpload: false,
			hasVault: true,
		},
	});
	await cache.clear();
	expect(await cache.getAll()).toEqual([]);
	expect(await cache.getMeta()).toEqual(DEFAULT_ITEM_CACHE_META);
});

test("old meta without tray prefs stays unclipped and does not tap-copy", () => {
	expect(
		asItemCacheMeta({
			syncEnabled: true,
			lastMe: null,
		}),
	).toEqual({
		syncEnabled: true,
		lastMe: null,
		clipLongNotes: false,
		tapNoteToCopy: false,
		tabIndent: true,
	});
	expect(
		asItemCacheMeta({
			syncEnabled: false,
			lastMe: null,
			clipLongNotes: true,
			tapNoteToCopy: true,
			tabIndent: false,
		}).tabIndent,
	).toBe(false);
});
