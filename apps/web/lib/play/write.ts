import { TEXT_PLAIN_MAX_BYTES } from "@meownow/protocol";
import { PLAY_CAP, PLAY_IMAGE_MAX_BYTES, type PlayNote, type PlayStore } from "./store";

export class PlayCapError extends Error {
	readonly code = "play_cap";
	constructor() {
		super("play_cap");
		this.name = "PlayCapError";
	}
}

export class PlayTooLargeError extends Error {
	readonly code = "play_too_large";
	constructor() {
		super("play_too_large");
		this.name = "PlayTooLargeError";
	}
}

export class PlayNotImageError extends Error {
	readonly code = "play_not_image";
	constructor() {
		super("play_not_image");
		this.name = "PlayNotImageError";
	}
}

export function playCountLabel(count: number, cap = PLAY_CAP): string {
	return `${count}/${cap}`;
}

export function playNoteKind(text: string): "text" | "link" {
	return /^https?:\/\//i.test(text) ? "link" : "text";
}

export function isPlayImageFile(file: File): boolean {
	return file.type.startsWith("image/") && file.type !== "image/svg+xml";
}

function preparedText(raw: string): string {
	const text = raw.trim();
	if (!text) {
		throw new Error("empty");
	}
	if (new TextEncoder().encode(text).length > TEXT_PLAIN_MAX_BYTES) {
		throw new PlayTooLargeError();
	}
	return text;
}

export async function addPlayNote(store: PlayStore, raw: string): Promise<PlayNote> {
	const text = preparedText(raw);
	const current = await store.list();
	if (current.length >= PLAY_CAP) {
		throw new PlayCapError();
	}
	const note: PlayNote = {
		id: crypto.randomUUID(),
		text,
		kind: playNoteKind(text),
		createdAt: new Date().toISOString(),
	};
	await store.put(note);
	return note;
}

export async function addPlayImage(store: PlayStore, file: File): Promise<PlayNote> {
	if (!isPlayImageFile(file)) {
		throw new PlayNotImageError();
	}
	if (file.size === 0 || file.size > PLAY_IMAGE_MAX_BYTES) {
		throw new PlayTooLargeError();
	}
	const current = await store.list();
	if (current.length >= PLAY_CAP) {
		throw new PlayCapError();
	}
	const note: PlayNote = {
		id: crypto.randomUUID(),
		text: file.name.trim() || "image.png",
		kind: "image",
		createdAt: new Date().toISOString(),
		blob: file,
	};
	await store.put(note);
	return note;
}

export async function replacePlayNote(
	store: PlayStore,
	id: string,
	raw: string,
): Promise<PlayNote> {
	const text = preparedText(raw);
	const current = (await store.list()).find((row) => row.id === id);
	if (!current || current.kind === "image") {
		throw new Error("not_found");
	}
	const note: PlayNote = {
		...current,
		text,
		kind: playNoteKind(text),
		createdAt: new Date().toISOString(),
	};
	await store.put(note);
	return note;
}

export async function forgetPlayNote(store: PlayStore, id: string): Promise<void> {
	await store.delete(id);
}
