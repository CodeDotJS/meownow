import { expect, test } from "vitest";
import { discardPlayIfLocal, SIGNED_OUT_HERO } from "./hero";
import type { PlayNote, PlayStore } from "./store";

class MemoryPlayStore implements PlayStore {
	private rows = new Map<string, PlayNote>();

	async list(): Promise<PlayNote[]> {
		return [...this.rows.values()];
	}

	async put(note: PlayNote): Promise<void> {
		this.rows.set(note.id, note);
	}

	async delete(id: string): Promise<void> {
		this.rows.delete(id);
	}

	async clear(): Promise<void> {
		this.rows.clear();
	}
}

test("signed-out hero always offers playground and passkey", () => {
	expect(SIGNED_OUT_HERO).toEqual([
		{ href: "/play", label: "Playground" },
		{ href: "/login", label: "Continue with passkey" },
	]);
});

test("a local vault drops the playground store", async () => {
	const store = new MemoryPlayStore();
	await store.put({
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		text: "scratch",
		kind: "text",
		createdAt: "2026-08-31T00:00:00.000Z",
	});
	await discardPlayIfLocal(false, store);
	expect((await store.list()).length).toBe(1);
	await discardPlayIfLocal(true, store);
	expect((await store.list()).length).toBe(0);
});
