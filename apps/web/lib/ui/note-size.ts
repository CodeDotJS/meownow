/** Matches the tray `-webkit-line-clamp` on `.log-item .body`. */
export const NOTE_CLAMP_LINES = 4;

/** About four tray lines of a long paragraph with no breaks. */
export const NOTE_READER_CHARS = 280;

export function noteLineCount(text: string): number {
	if (text.length === 0) {
		return 0;
	}
	let lines = 1;
	for (const char of text) {
		if (char === "\n") {
			lines += 1;
		}
	}
	return lines;
}

export function textNeedsReader(text: string): boolean {
	return text.length > NOTE_READER_CHARS || noteLineCount(text) > NOTE_CLAMP_LINES;
}
