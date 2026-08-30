import { expect, test } from "vitest";
import { PLAY_CAP, PLAY_DB, type PlayNote, type PlayStore } from "./store";
import {
	addPlayNote,
	forgetPlayNote,
	PlayCapError,
	PlayTooLargeError,
	playCountLabel,
	replacePlayNote,
} from "./write";

class MemoryPlayStore implements PlayStore {
	private rows = new Map<string, PlayNote>();

	async list(): Promise<PlayNote[]> {
		return [...this.rows.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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

test("playground notes are not the member item cache", () => {
	expect(PLAY_DB).toBe("meownow-play");
	expect(PLAY_DB).not.toBe("meownow-items");
	expect(PLAY_CAP).toBe(5);
	expect(playCountLabel(0)).toBe("0/5");
	expect(playCountLabel(3)).toBe("3/5");
	expect(playCountLabel(5)).toBe("5/5");
});

test("five notes succeed and the sixth is refused", async () => {
	const store = new MemoryPlayStore();
	for (let i = 0; i < PLAY_CAP; i += 1) {
		await addPlayNote(store, `note ${i}`);
	}
	expect((await store.list()).length).toBe(PLAY_CAP);
	await expect(addPlayNote(store, "one more")).rejects.toBeInstanceOf(PlayCapError);
	expect((await store.list()).length).toBe(PLAY_CAP);
});

test("forget frees a slot and edit does not consume one", async () => {
	const store = new MemoryPlayStore();
	const first = await addPlayNote(store, "keep");
	for (let i = 0; i < PLAY_CAP - 1; i += 1) {
		await addPlayNote(store, `fill ${i}`);
	}
	const edited = await replacePlayNote(store, first.id, "https://meownow.example");
	expect(edited.kind).toBe("link");
	expect((await store.list()).length).toBe(PLAY_CAP);
	await forgetPlayNote(store, first.id);
	expect((await store.list()).length).toBe(PLAY_CAP - 1);
	await addPlayNote(store, "freed");
	expect((await store.list()).length).toBe(PLAY_CAP);
});

test("empty and oversized notes are refused", async () => {
	const store = new MemoryPlayStore();
	await expect(addPlayNote(store, "   ")).rejects.toThrow(/empty/);
	await expect(addPlayNote(store, "x".repeat(64 * 1024 + 1))).rejects.toBeInstanceOf(
		PlayTooLargeError,
	);
	expect((await store.list()).length).toBe(0);
});
