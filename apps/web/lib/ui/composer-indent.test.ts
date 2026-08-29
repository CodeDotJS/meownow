import { expect, test } from "vitest";
import { applyComposerIndent, COMPOSER_INDENT } from "./composer-indent";

test("tab at the caret inserts four spaces", () => {
	expect(applyComposerIndent({ text: "ab", start: 1, end: 1 }, "in")).toEqual({
		text: `a${COMPOSER_INDENT}b`,
		start: 5,
		end: 5,
	});
});

test("tab nests a list line and shift-tab peels four spaces", () => {
	const nested = applyComposerIndent({ text: "- one", start: 0, end: 0 }, "in");
	expect(nested.text).toBe("    - one");
	expect(applyComposerIndent({ text: nested.text, start: 4, end: 4 }, "out").text).toBe("- one");
});

test("tab indents every selected line", () => {
	const next = applyComposerIndent({ text: "- a\n- b", start: 0, end: 7 }, "in");
	expect(next.text).toBe("    - a\n    - b");
	expect(next.start).toBe(4);
	expect(next.end).toBe(15);
});
