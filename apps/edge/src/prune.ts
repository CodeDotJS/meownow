export function r2Prefix(key: string): string {
	const slash = key.indexOf("/");
	return slash === -1 ? key : key.slice(0, slash);
}

export type SweepBucket = {
	list: (input?: { cursor?: string }) => Promise<{
		objects: Array<{ key: string }>;
		truncated?: boolean;
		cursor?: string;
	}>;
	delete: (key: string) => Promise<unknown>;
};

export async function sweepOrphans(
	bucket: SweepBucket,
	keepPrefixes: Set<string>,
): Promise<number> {
	let deleted = 0;
	let cursor: string | undefined;
	do {
		const listed = await bucket.list(cursor ? { cursor } : undefined);
		for (const object of listed.objects) {
			if (!keepPrefixes.has(r2Prefix(object.key))) {
				await bucket.delete(object.key);
				deleted += 1;
			}
		}
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);
	return deleted;
}
