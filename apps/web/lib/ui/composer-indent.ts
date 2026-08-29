export const COMPOSER_INDENT = "    ";

export type ComposerRange = {
	text: string;
	start: number;
	end: number;
};

function lineStart(text: string, index: number): number {
	const at = text.lastIndexOf("\n", Math.max(0, index) - 1);
	return at === -1 ? 0 : at + 1;
}

function lineEnd(text: string, index: number): number {
	const at = text.indexOf("\n", index);
	return at === -1 ? text.length : at;
}

function leadingSpaces(line: string, max: number): number {
	let count = 0;
	while (count < max && line[count] === " ") {
		count += 1;
	}
	return count;
}

/** Tab inserts four spaces at the caret, or at the start of each selected line. */
export function applyComposerIndent(draft: ComposerRange, direction: "in" | "out"): ComposerRange {
	const from = Math.min(draft.start, draft.end);
	const to = Math.max(draft.start, draft.end);
	if (direction === "in" && from === to) {
		const next = draft.text.slice(0, from) + COMPOSER_INDENT + draft.text.slice(from);
		const caret = from + COMPOSER_INDENT.length;
		return { text: next, start: caret, end: caret };
	}
	const blockFrom = lineStart(draft.text, from);
	const lastIndex = to > from && draft.text[to - 1] === "\n" ? to - 1 : to;
	const blockTo = lineEnd(draft.text, lastIndex);
	const block = draft.text.slice(blockFrom, blockTo);
	const lines = block.split("\n");
	if (direction === "in") {
		const nextBlock = lines.map((line) => COMPOSER_INDENT + line).join("\n");
		return {
			text: draft.text.slice(0, blockFrom) + nextBlock + draft.text.slice(blockTo),
			start: from + COMPOSER_INDENT.length,
			end: to + COMPOSER_INDENT.length * lines.length,
		};
	}
	let removedBefore = 0;
	let removedTotal = 0;
	const nextLines = lines.map((line, index) => {
		const cut = leadingSpaces(line, COMPOSER_INDENT.length);
		if (index === 0) {
			removedBefore = cut;
		}
		removedTotal += cut;
		return line.slice(cut);
	});
	const nextBlock = nextLines.join("\n");
	const start = Math.max(blockFrom, from - removedBefore);
	return {
		text: draft.text.slice(0, blockFrom) + nextBlock + draft.text.slice(blockTo),
		start,
		end: Math.max(start, to - removedTotal),
	};
}
