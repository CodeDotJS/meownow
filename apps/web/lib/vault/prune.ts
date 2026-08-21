import { PENDING_BLOB_MAX_AGE_MS } from "@meownow/protocol";

export type PruneItem = {
	id: string;
	pinned: boolean;
	expiresAt: number;
	blobId: string | null;
};

export type PruneBlob = {
	id: string;
	r2Key: string;
	state: "pending" | "committed";
	createdAt: number;
	ownerId: string;
	byteSize: number;
};

export type PrunePlan = {
	deleteItemIds: string[];
	deletePairingIds: string[];
	deleteSessionKeys: string[];
	deleteBlobIds: string[];
	decrementUsage: Array<{ ownerId: string; bytes: number }>;
	deleteR2Keys: string[];
	keepR2Keys: string[];
};

export function planPrune(input: {
	now: number;
	items: PruneItem[];
	blobs: PruneBlob[];
	pairings: Array<{ id: string; expiresAt: number }>;
	sessions: Array<{ key: string; expiresAt: number }>;
}): PrunePlan {
	const deleteItemIds = input.items
		.filter((item) => !item.pinned && item.expiresAt <= input.now)
		.map((item) => item.id);
	const deletedItems = new Set(deleteItemIds);
	const liveBlobIds = new Set(
		input.items
			.filter((item) => !deletedItems.has(item.id) && item.blobId)
			.map((item) => item.blobId)
			.filter((id): id is string => typeof id === "string"),
	);
	const deletePairingIds = input.pairings
		.filter((row) => row.expiresAt <= input.now)
		.map((row) => row.id);
	const deleteSessionKeys = input.sessions
		.filter((row) => row.expiresAt <= input.now)
		.map((row) => row.key);

	const deleteBlobIds: string[] = [];
	const decrementUsage: Array<{ ownerId: string; bytes: number }> = [];
	const deleteR2Keys: string[] = [];
	const keepR2Keys: string[] = [];

	for (const blob of input.blobs) {
		const pendingExpired =
			blob.state === "pending" && input.now - blob.createdAt >= PENDING_BLOB_MAX_AGE_MS;
		const orphanedCommitted = blob.state === "committed" && !liveBlobIds.has(blob.id);
		if (pendingExpired || orphanedCommitted) {
			deleteBlobIds.push(blob.id);
			deleteR2Keys.push(blob.r2Key);
			if (orphanedCommitted) {
				decrementUsage.push({ ownerId: blob.ownerId, bytes: blob.byteSize });
			}
		} else {
			keepR2Keys.push(blob.r2Key);
		}
	}

	return {
		deleteItemIds,
		deletePairingIds,
		deleteSessionKeys,
		deleteBlobIds,
		decrementUsage,
		deleteR2Keys,
		keepR2Keys,
	};
}

export function r2Prefix(key: string): string {
	const slash = key.indexOf("/");
	return slash === -1 ? key : key.slice(0, slash);
}
