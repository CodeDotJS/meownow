import { expect, test } from "vitest";
import { PLAY_CAP, PLAY_DB, PLAY_IMAGE_MAX_BYTES, type PlayNote, type PlayStore } from "./store";
import {
	addPlayImage,
	addPlayNote,
	forgetPlayNote,
	isPlayImageFile,
	PlayCapError,
	PlayNotImageError,
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

function stubImage(name: string, type: string, bytes = 8): File {
	return new File([new Uint8Array(bytes)], name, { type });
}

test("playground accepts a local image and counts it toward the cap", async () => {
	const store = new MemoryPlayStore();
	const png = stubImage("shot.png", "image/png");
	expect(isPlayImageFile(png)).toBe(true);
	const note = await addPlayImage(store, png);
	expect(note.kind).toBe("image");
	expect(note.text).toBe("shot.png");
	expect(note.blob?.type).toBe("image/png");
	expect((await store.list()).length).toBe(1);
});

test("a sixth image is refused and forget frees the slot", async () => {
	const store = new MemoryPlayStore();
	for (let i = 0; i < PLAY_CAP - 1; i += 1) {
		await addPlayNote(store, `note ${i}`);
	}
	await addPlayImage(store, stubImage("last.png", "image/png"));
	await expect(addPlayImage(store, stubImage("overflow.png", "image/png"))).rejects.toBeInstanceOf(
		PlayCapError,
	);
	const listed = await store.list();
	const image = listed.find((row) => row.kind === "image");
	expect(image).toBeDefined();
	if (!image) {
		return;
	}
	await forgetPlayNote(store, image.id);
	await addPlayImage(store, stubImage("again.png", "image/png"));
	expect((await store.list()).length).toBe(PLAY_CAP);
});

test("playground images stay raster and local-sized", async () => {
	const store = new MemoryPlayStore();
	await expect(
		addPlayImage(store, stubImage("notes.pdf", "application/pdf")),
	).rejects.toBeInstanceOf(PlayNotImageError);
	await expect(addPlayImage(store, stubImage("icon.svg", "image/svg+xml"))).rejects.toBeInstanceOf(
		PlayNotImageError,
	);
	await expect(addPlayImage(store, stubImage("empty.png", "image/png", 0))).rejects.toBeInstanceOf(
		PlayTooLargeError,
	);
	await expect(
		addPlayImage(store, stubImage("huge.png", "image/png", PLAY_IMAGE_MAX_BYTES + 1)),
	).rejects.toBeInstanceOf(PlayTooLargeError);
	expect(isPlayImageFile(stubImage("a.webp", "image/webp"))).toBe(true);
	expect((await store.list()).length).toBe(0);
});

test("image notes are not edited as text", async () => {
	const store = new MemoryPlayStore();
	const image = await addPlayImage(store, stubImage("shot.png", "image/png"));
	await expect(replacePlayNote(store, image.id, "nope")).rejects.toThrow(/not_found/);
	expect((await store.list())[0]?.kind).toBe("image");
});
