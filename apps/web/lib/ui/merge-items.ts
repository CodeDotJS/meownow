export type MergeableItem = {
	id: string;
	createdAt: string;
	ephemeral?: boolean;
};

export function mergeRemoteItems<T extends MergeableItem>(
	current: T[],
	opened: T[],
	input: { tombstones: Iterable<string>; pending: Iterable<string> },
): T[] {
	const tombstones = new Set(input.tombstones);
	const pending = new Set(input.pending);
	const byId = new Map<string, T>();
	for (const row of opened) {
		if (!tombstones.has(row.id)) {
			byId.set(row.id, row);
		}
	}
	for (const row of current) {
		if (tombstones.has(row.id) || byId.has(row.id)) {
			continue;
		}
		if (row.ephemeral || pending.has(row.id)) {
			byId.set(row.id, row);
		}
	}
	return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
