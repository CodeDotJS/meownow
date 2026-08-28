export type TaskPart =
	| { type: "text"; value: string; at: number }
	| { type: "box"; checked: boolean; at: number };

const MARK = /\[([ xX])\]/g;

export function splitTaskMarks(text: string): TaskPart[] {
	const parts: TaskPart[] = [];
	let last = 0;
	for (const match of text.matchAll(MARK)) {
		const index = match.index;
		if (index === undefined) {
			continue;
		}
		if (index > last) {
			parts.push({ type: "text", value: text.slice(last, index), at: last });
		}
		const mark = match[1];
		parts.push({ type: "box", checked: mark !== " ", at: index });
		last = index + match[0].length;
	}
	if (parts.length === 0) {
		return [{ type: "text", value: text, at: 0 }];
	}
	if (last < text.length) {
		parts.push({ type: "text", value: text.slice(last), at: last });
	}
	return parts;
}
