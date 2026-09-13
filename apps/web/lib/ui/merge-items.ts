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

export function replaceAndSort<T extends MergeableItem>(current: T[], row: T): T[] {
	const next = current.some((entry) => entry.id === row.id)
		? current.map((entry) => (entry.id === row.id ? { ...entry, ...row } : entry))
		: [row, ...current];
	return next.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Keep on-screen in-flight writes when a refresh rebuilds the pending set. */
export function nextPendingIds(
	previous: Iterable<string>,
	shownIds: Iterable<string>,
	cachedUnsynced: Iterable<string>,
): Set<string> {
	const shown = new Set(shownIds);
	const next = new Set(cachedUnsynced);
	for (const id of previous) {
		if (shown.has(id)) {
			next.add(id);
		}
	}
	return next;
}
