const DB_NAME = "meownow";
const STORE = "vault";
const KEY = "current";

export type StoredVault = {
	userId: string;
	vaultKey: CryptoKey;
	deviceKey: CryptoKey;
	wrappedExtractable: { iv: Uint8Array; bytes: Uint8Array };
	wrappedIdentity: { iv: Uint8Array; bytes: Uint8Array };
	identityPub: JsonWebKey;
};

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function saveVault(record: StoredVault): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(record, KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function loadVault(): Promise<StoredVault | null> {
	const db = await openDb();
	const record = await new Promise<StoredVault | null>((resolve, reject) => {
		const tx = db.transaction(STORE, "readonly");
		const req = tx.objectStore(STORE).get(KEY);
		req.onsuccess = () => resolve((req.result as StoredVault | undefined) ?? null);
		req.onerror = () => reject(req.error);
	});
	db.close();
	return record;
}

export async function clearVault(): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).delete(KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}
