const DB_NAME = "meownow-share";
const STORE = "inbox";
const KEY = "pending";

export async function saveIncomingShare(payload: {
	text: string;
	kind: "text" | "link";
}): Promise<void> {
	const db = await openShareDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(payload, KEY);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function takeIncomingShare(): Promise<{ text: string; kind: "text" | "link" } | null> {
	const db = await openShareDb();
	const record = await new Promise<{ text: string; kind: "text" | "link" } | null>(
		(resolve, reject) => {
			const tx = db.transaction(STORE, "readwrite");
			const store = tx.objectStore(STORE);
			const req = store.get(KEY);
			req.onsuccess = () => {
				const value = (req.result as { text: string; kind: "text" | "link" } | undefined) ?? null;
				if (value) {
					store.delete(KEY);
				}
				resolve(value);
			};
			req.onerror = () => reject(req.error);
		},
	);
	db.close();
	return record;
}

function openShareDb(): Promise<IDBDatabase> {
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
