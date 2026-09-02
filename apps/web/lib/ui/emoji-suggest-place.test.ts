import { expect, test } from "vitest";
import { emojiSuggestBelow, emojiSuggestListHeight } from "./emoji-suggest-place";

test("caps the list height", () => {
	expect(emojiSuggestListHeight(1)).toBeLessThan(emojiSuggestListHeight(8));
	expect(emojiSuggestListHeight(20)).toBe(224);
});

test("flips below when the caret is too close to the top", () => {
	expect(
		emojiSuggestBelow({
			caretTop: 80,
			caretHeight: 24,
			listHeight: 180,
			viewHeight: 800,
		}),
	).toBe(true);
	expect(
		emojiSuggestBelow({
			caretTop: 420,
			caretHeight: 24,
			listHeight: 180,
			viewHeight: 800,
		}),
	).toBe(false);
});

test("uses the side with more room when both are tight", () => {
	expect(
		emojiSuggestBelow({
			caretTop: 40,
			caretHeight: 24,
			listHeight: 200,
			viewHeight: 120,
		}),
	).toBe(true);
});
