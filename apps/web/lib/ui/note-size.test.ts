import { expect, test } from "vitest";
import { NOTE_CLAMP_LINES, NOTE_READER_CHARS, noteLineCount, textNeedsReader } from "./note-size";

test("short notes still copy from the tray", () => {
	expect(textNeedsReader("a short paste")).toBe(false);
	expect(textNeedsReader("one\ntwo\nthree\nfour")).toBe(false);
});

test("opens a reader past the tray clamp", () => {
	expect(textNeedsReader("one\ntwo\nthree\nfour\nfive")).toBe(true);
	expect(textNeedsReader("x".repeat(NOTE_READER_CHARS + 1))).toBe(true);
	expect(noteLineCount(Array.from({ length: 1000 }, () => "line").join("\n"))).toBe(1000);
	expect(
		textNeedsReader(Array.from({ length: NOTE_CLAMP_LINES + 1 }, () => "line").join("\n")),
	).toBe(true);
});
