import { expect, test } from "vitest";
import {
	closeShortcodeAtCaret,
	expandEmojiShortcodes,
	insertEmojiAt,
	isCodeContext,
	resolveShortcode,
	shortcodeQueryAt,
	suggestEmoji,
} from "./emoji-shortcodes";

test("resolves gemoji aliases and the laugh tag", () => {
	expect(resolveShortcode("laughing")).toBe("😆");
	expect(resolveShortcode("smile")).toBe("😄");
	expect(resolveShortcode("laugh")).toBe("😄");
	expect(resolveShortcode("+1")).toBe("👍");
});

test("suggests laugh names above the caret query", () => {
	const hits = suggestEmoji("laugh");
	expect(hits.length).toBeGreaterThan(0);
	expect(hits.some((hit) => hit.alias === "laughing" && hit.emoji === "😆")).toBe(true);
	expect(hits.some((hit) => hit.alias === "laugh" && hit.emoji === "😄")).toBe(true);
	expect(hits[0]?.via).toBe("alias");
});

test("does not treat unmatched backticks as a code span", () => {
	expect(isCodeContext("say `:x", 4)).toBe(false);
	expect(isCodeContext("say `:x`", 4)).toBe(true);
	expect(isCodeContext("```\n:smile:\n```", 4)).toBe(true);
});

test("reads an open shortcode at the caret", () => {
	expect(shortcodeQueryAt("hi :lau", 7)).toEqual({ start: 3, query: "lau" });
	expect(shortcodeQueryAt("ratio:lau", 9)).toBeNull();
	expect(shortcodeQueryAt("` :lau`", 6)).toBeNull();
});

test("closes a known shortcode at the caret", () => {
	const closed = closeShortcodeAtCaret("ok :laugh:", 10);
	expect(closed?.text).toBe("ok 😄 ");
	expect(closed?.caret).toBe(6);
	expect(closeShortcodeAtCaret("ok :nope:", 9)).toBeNull();
});

test("inserts a trailing space so the next word is not glued", () => {
	expect(insertEmojiAt("hi :lau", 3, 7, "😄")).toEqual({ text: "hi 😄 ", caret: 6 });
});

test("expands shortcodes in prose and leaves code alone", () => {
	expect(expandEmojiShortcodes("a :smile: b")).toBe("a 😄 b");
	expect(expandEmojiShortcodes("`:smile:`")).toBe("`:smile:`");
	expect(expandEmojiShortcodes("```\n:smile:\n```")).toBe("```\n:smile:\n```");
});
