import shortcodes from "./emoji-shortcodes.json";

export type EmojiHit = {
	alias: string;
	emoji: string;
	via: "alias" | "tag";
};

const aliases: Record<string, string> = shortcodes.aliases;
const tags: Record<string, string> = shortcodes.tags;

const NAME = /^[a-z0-9_+-]{1,40}$/i;
const CLOSED = /:([a-z0-9_+-]{1,40}):/gi;

export function resolveShortcode(name: string): string | undefined {
	const key = name.toLowerCase();
	return aliases[key] ?? tags[key];
}

export function suggestEmoji(query: string, limit = 8): EmojiHit[] {
	const q = query.toLowerCase();
	if (q.length === 0 || !/^[a-z0-9_+-]+$/i.test(q)) {
		return [];
	}
	const hits: EmojiHit[] = [];
	const seen = new Set<string>();
	for (const [alias, emoji] of Object.entries(aliases)) {
		if (!alias.startsWith(q) || seen.has(alias)) {
			continue;
		}
		seen.add(alias);
		hits.push({ alias, emoji, via: "alias" });
	}
	for (const [alias, emoji] of Object.entries(tags)) {
		if (!alias.startsWith(q) || seen.has(alias)) {
			continue;
		}
		seen.add(alias);
		hits.push({ alias, emoji, via: "tag" });
	}
	hits.sort((a, b) => {
		if (a.via !== b.via) {
			return a.via === "alias" ? -1 : 1;
		}
		if (a.alias === q && b.alias !== q) {
			return -1;
		}
		if (b.alias === q && a.alias !== q) {
			return 1;
		}
		return a.alias.length - b.alias.length || a.alias.localeCompare(b.alias);
	});
	return hits.slice(0, limit);
}

export function isCodeContext(text: string, index: number): boolean {
	let i = 0;
	while (i < text.length && i <= index) {
		const atLine = i === 0 || text[i - 1] === "\n";
		if (atLine && text.startsWith("```", i)) {
			const close = text.indexOf("\n```", i + 3);
			const end = close === -1 ? text.length : close + 4;
			if (index >= i && index < end) {
				return true;
			}
			i = end;
			continue;
		}
		if (text[i] === "`") {
			let ticks = 1;
			while (text[i + ticks] === "`") {
				ticks += 1;
			}
			const marker = "`".repeat(ticks);
			const close = text.indexOf(marker, i + ticks);
			if (close === -1) {
				i += ticks;
				continue;
			}
			const end = close + ticks;
			if (index >= i && index < end) {
				return true;
			}
			i = end;
			continue;
		}
		i += 1;
	}
	return false;
}

function blockedBoundary(text: string, colonAt: number): boolean {
	if (colonAt === 0) {
		return false;
	}
	const prev = text[colonAt - 1];
	return prev !== undefined && /[a-zA-Z0-9/]/.test(prev);
}

export function shortcodeQueryAt(
	text: string,
	caret: number,
): { start: number; query: string } | null {
	if (caret < 1 || caret > text.length) {
		return null;
	}
	const before = text.slice(0, caret);
	const match = before.match(/:([a-z0-9_+-]{0,40})$/i);
	if (!match || match.index === undefined) {
		return null;
	}
	const start = match.index;
	if (isCodeContext(text, start) || blockedBoundary(text, start)) {
		return null;
	}
	const query = (match[1] ?? "").toLowerCase();
	if (query.length === 0) {
		return null;
	}
	return { start, query };
}

export function closeShortcodeAtCaret(
	text: string,
	caret: number,
): { text: string; caret: number } | null {
	if (caret < 3 || caret > text.length) {
		return null;
	}
	const before = text.slice(0, caret);
	const match = before.match(/:([a-z0-9_+-]{1,40}):$/i);
	if (!match || match.index === undefined) {
		return null;
	}
	const name = match[1];
	if (!name || !NAME.test(name)) {
		return null;
	}
	const start = match.index;
	if (isCodeContext(text, start) || blockedBoundary(text, start)) {
		return null;
	}
	const emoji = resolveShortcode(name);
	if (!emoji) {
		return null;
	}
	return {
		text: `${before.slice(0, start)}${emoji} ${text.slice(caret)}`,
		caret: start + emoji.length + 1,
	};
}

export function expandEmojiShortcodes(text: string): string {
	return text.replace(CLOSED, (full, name: string, offset: number) => {
		if (
			typeof offset !== "number" ||
			isCodeContext(text, offset) ||
			blockedBoundary(text, offset)
		) {
			return full;
		}
		return resolveShortcode(name) ?? full;
	});
}

export function insertEmojiAt(
	text: string,
	start: number,
	caret: number,
	emoji: string,
): { text: string; caret: number } {
	return {
		text: `${text.slice(0, start)}${emoji} ${text.slice(caret)}`,
		caret: start + emoji.length + 1,
	};
}
