import { errorCode, postJson } from "@/lib/client/http";
import { getCachedItems, getItemCacheMeta, putCachedItem, setItemCacheMeta } from "./item-cache";
import { type CachedItem, releaseHeld, toCreatePayload } from "./outbox";

export type FlushResult = {
	flushed: number;
	error: string | null;
};

function browserOnline(): boolean {
	return typeof navigator !== "undefined" && navigator.onLine;
}

async function postCached(row: CachedItem): Promise<"ok" | "offline" | string> {
	const res = await postJson("/api/items", toCreatePayload(row));
	if (res.ok) {
		await putCachedItem({ ...row, state: "synced" });
		return "ok";
	}
	if (res.status === 0) {
		return "offline";
	}
	return errorCode(res.data);
}

export async function flushQueuedItems(): Promise<FlushResult> {
	const meta = await getItemCacheMeta();
	if (!meta.syncEnabled || !browserOnline()) {
		return { flushed: 0, error: null };
	}
	const rows = (await getCachedItems()).filter((row) => row.state === "queued");
	let flushed = 0;
	let error: string | null = null;
	for (const row of rows) {
		const result = await postCached(row);
		if (result === "ok") {
			flushed += 1;
			continue;
		}
		if (result === "offline") {
			break;
		}
		error = result;
	}
	return { flushed, error };
}

export async function syncCachedItem(id: string): Promise<"ok" | "offline" | string> {
	const row = (await getCachedItems()).find((item) => item.id === id);
	if (!row || row.state === "synced") {
		return "ok";
	}
	if (!browserOnline()) {
		return "offline";
	}
	return postCached(row);
}

export async function syncAllUnsynced(): Promise<FlushResult> {
	if (!browserOnline()) {
		return { flushed: 0, error: "offline" };
	}
	const rows = (await getCachedItems()).filter(
		(row) => row.state === "queued" || row.state === "held",
	);
	let flushed = 0;
	let error: string | null = null;
	for (const row of rows) {
		const result = await postCached(row);
		if (result === "ok") {
			flushed += 1;
			continue;
		}
		if (result === "offline") {
			error = "offline";
			break;
		}
		error = result;
	}
	return { flushed, error };
}

export async function setSyncEnabled(enabled: boolean): Promise<FlushResult> {
	const meta = await getItemCacheMeta();
	await setItemCacheMeta({ ...meta, syncEnabled: enabled });
	if (!enabled) {
		return { flushed: 0, error: null };
	}
	for (const row of releaseHeld(await getCachedItems())) {
		await putCachedItem(row);
	}
	return flushQueuedItems();
}
