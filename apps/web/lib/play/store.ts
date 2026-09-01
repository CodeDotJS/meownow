export const PLAY_DB = "meownow-play";
export const PLAY_CAP = 5;
export const PLAY_IMAGE_MAX_BYTES = 12 * 1024 * 1024;

const RECORDS = "records";

export type PlayNote = {
	id: string;
	text: string;
	kind: "text" | "link" | "image";
	createdAt: string;
	blob?: Blob;
};

export type PlayStore = {
	list(): Promise<PlayNote[]>;
	put(note: PlayNote): Promise<void>;
	delete(id: string): Promise<void>;
	clear(): Promise<void>;
};

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(PLAY_DB, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(RECORDS)) {
				db.createObjectStore(RECORDS);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function listPlayNotes(): Promise<PlayNote[]> {
	const db = await openDb();
	const rows = await new Promise<PlayNote[]>((resolve, reject) => {
		const tx = db.transaction(RECORDS, "readonly");
		const req = tx.objectStore(RECORDS).getAll();
		req.onsuccess = () => resolve((req.result as PlayNote[] | undefined) ?? []);
		req.onerror = () => reject(req.error);
	});
	db.close();
	return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function putPlayNote(note: PlayNote): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(RECORDS, "readwrite");
		tx.objectStore(RECORDS).put(note, note.id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function deletePlayNote(id: string): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(RECORDS, "readwrite");
		tx.objectStore(RECORDS).delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function clearPlayStore(): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(RECORDS, "readwrite");
		tx.objectStore(RECORDS).clear();
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export const idbPlayStore: PlayStore = {
	list: listPlayNotes,
	put: putPlayNote,
	delete: deletePlayNote,
	clear: clearPlayStore,
};
