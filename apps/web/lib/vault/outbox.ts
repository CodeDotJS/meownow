import type { ItemCreateRequest, ItemUpdateRequest } from "@meownow/protocol";

export type OutboxState = "queued" | "held" | "synced" | "dirty";

export type CachedItem = {
	id: string;
	kind: "text" | "link";
	ciphertext: string;
	metaCiphertext: string;
	iv: string;
	byteSize: number;
	createdAt: string;
	expiresAt: string;
	state: OutboxState;
};

export function unsynced(items: CachedItem[]): CachedItem[] {
	return items
		.filter((row) => row.state === "queued" || row.state === "held" || row.state === "dirty")
		.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function shouldAutoFlush(input: {
	syncEnabled: boolean;
	online: boolean;
	state: OutboxState;
}): boolean {
	return input.syncEnabled && input.online && (input.state === "queued" || input.state === "dirty");
}

export function releaseHeld(items: CachedItem[]): CachedItem[] {
	return items.map((row) => (row.state === "held" ? { ...row, state: "queued" } : row));
}

export function markSynced(items: CachedItem[], id: string): CachedItem[] {
	return items.map((row) => (row.id === id ? { ...row, state: "synced" } : row));
}

export function drop(items: CachedItem[], id: string): CachedItem[] {
	return items.filter((row) => row.id !== id);
}

export function dropExpired(items: CachedItem[], now: Date): CachedItem[] {
	const t = now.getTime();
	return items.filter((row) => Date.parse(row.expiresAt) > t);
}

export function toCreatePayload(row: CachedItem): ItemCreateRequest {
	return {
		id: row.id,
		kind: row.kind,
		ciphertext: row.ciphertext,
		metaCiphertext: row.metaCiphertext,
		iv: row.iv,
		byteSize: row.byteSize,
		expiresAt: row.expiresAt,
	};
}

export function toUpdatePayload(row: CachedItem): ItemUpdateRequest {
	return {
		kind: row.kind,
		ciphertext: row.ciphertext,
		metaCiphertext: row.metaCiphertext,
		iv: row.iv,
		byteSize: row.byteSize,
	};
}
