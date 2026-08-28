import type { Token } from "marked";
import { expect, test } from "vitest";
import { lexNote } from "./note-lex";

function types(tokens: Token[]): string[] {
	const out: string[] = [];
	function walk(list: Token[]): void {
		for (const token of list) {
			out.push(token.type);
			if ("tokens" in token && Array.isArray(token.tokens)) {
				walk(token.tokens);
			}
			if (token.type === "list") {
				for (const item of token.items) {
					walk(item.tokens);
				}
			}
		}
	}
	walk(tokens);
	return out;
}

test("keeps single newlines as breaks so existing notes do not collapse", () => {
	expect(types(lexNote("line one\nline two"))).toContain("br");
});

test("lexes emphasis and leaves script tags as html tokens for the renderer to show as text", () => {
	expect(types(lexNote("**bold** and *em*"))).toEqual(expect.arrayContaining(["strong", "em"]));
	expect(types(lexNote("<script>alert(1)</script>"))).toContain("html");
});

test("lexes dash lists and GFM task boxes", () => {
	expect(types(lexNote("- one\n- two"))).toContain("list");
	expect(types(lexNote("- [ ] open\n- [x] done"))).toEqual(
		expect.arrayContaining(["list", "checkbox"]),
	);
});
