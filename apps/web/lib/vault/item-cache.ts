import { type CachedItem, dropExpired } from "./outbox";

const DB_NAME = "meownow-items";
const META_STORE = "meta";
const RECORDS_STORE = "records";
const META_KEY = "current";

export type LastMe = {
	id: string;
	handle: string;
	displayName: string;
	role: "admin" | "member";
	canUpload: boolean;
	hasVault: boolean;
};

export type ItemCacheMeta = {
	syncEnabled: boolean;
	lastMe: LastMe | null;
};

export const DEFAULT_ITEM_CACHE_META: ItemCacheMeta = {
	syncEnabled: true,
	lastMe: null,
};

export type ItemCacheStore = {
	getMeta(): Promise<ItemCacheMeta>;
	setMeta(meta: ItemCacheMeta): Promise<void>;
	put(item: CachedItem): Promise<void>;
	getAll(): Promise<CachedItem[]>;
	delete(id: string): Promise<void>;
	clear(): Promise<void>;
};

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(META_STORE)) {
				db.createObjectStore(META_STORE);
			}
			if (!db.objectStoreNames.contains(RECORDS_STORE)) {
				db.createObjectStore(RECORDS_STORE);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function getItemCacheMeta(): Promise<ItemCacheMeta> {
	const db = await openDb();
	const record = await new Promise<ItemCacheMeta | null>((resolve, reject) => {
		const tx = db.transaction(META_STORE, "readonly");
		const req = tx.objectStore(META_STORE).get(META_KEY);
		req.onsuccess = () => resolve((req.result as ItemCacheMeta | undefined) ?? null);
		req.onerror = () => reject(req.error);
	});
	db.close();
	return record ?? { ...DEFAULT_ITEM_CACHE_META };
}

export async function setItemCacheMeta(meta: ItemCacheMeta): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(META_STORE, "readwrite");
		tx.objectStore(META_STORE).put(meta, META_KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function putCachedItem(item: CachedItem): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(RECORDS_STORE, "readwrite");
		tx.objectStore(RECORDS_STORE).put(item, item.id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function getCachedItems(): Promise<CachedItem[]> {
	const db = await openDb();
	const rows = await new Promise<CachedItem[]>((resolve, reject) => {
		const tx = db.transaction(RECORDS_STORE, "readonly");
		const req = tx.objectStore(RECORDS_STORE).getAll();
		req.onsuccess = () => resolve((req.result as CachedItem[] | undefined) ?? []);
		req.onerror = () => reject(req.error);
	});
	db.close();
	return rows;
}

export async function deleteCachedItem(id: string): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(RECORDS_STORE, "readwrite");
		tx.objectStore(RECORDS_STORE).delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function clearItemCache(): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction([META_STORE, RECORDS_STORE], "readwrite");
		tx.objectStore(META_STORE).clear();
		tx.objectStore(RECORDS_STORE).clear();
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export const idbItemCache: ItemCacheStore = {
	getMeta: getItemCacheMeta,
	setMeta: setItemCacheMeta,
	put: putCachedItem,
	getAll: getCachedItems,
	delete: deleteCachedItem,
	clear: clearItemCache,
};

export async function pruneExpiredCachedItems(now = new Date()): Promise<CachedItem[]> {
	const all = await getCachedItems();
	const keep = dropExpired(all, now);
	const keepIds = new Set(keep.map((row) => row.id));
	for (const row of all) {
		if (!keepIds.has(row.id)) {
			await deleteCachedItem(row.id);
		}
	}
	return keep;
}

export async function upsertSyncedFromRemote(
	items: Array<{
		id: string;
		kind: "text" | "link" | "image" | "file";
		ciphertext?: string;
		metaCiphertext: string;
		iv: string;
		byteSize?: number;
		createdAt: string;
		expiresAt: string;
	}>,
): Promise<void> {
	const remoteIds = new Set(items.map((item) => item.id));
	const cached = await getCachedItems();
	for (const row of cached) {
		if (row.state === "synced" && !remoteIds.has(row.id)) {
			await deleteCachedItem(row.id);
		}
	}
	const byId = new Map(cached.map((row) => [row.id, row]));
	for (const item of items) {
		if (item.kind !== "text" && item.kind !== "link") {
			continue;
		}
		if (!item.ciphertext) {
			continue;
		}
		const existing = byId.get(item.id);
		if (existing?.state === "queued" || existing?.state === "held") {
			continue;
		}
		await putCachedItem({
			id: item.id,
			kind: item.kind,
			ciphertext: item.ciphertext,
			metaCiphertext: item.metaCiphertext,
			iv: item.iv,
			byteSize: item.byteSize ?? 0,
			createdAt: item.createdAt,
			expiresAt: item.expiresAt,
			state: "synced",
		});
	}
}
