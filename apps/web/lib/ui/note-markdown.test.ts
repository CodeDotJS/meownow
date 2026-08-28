import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { NoteMarkdown } from "./note-markdown";

function html(text: string, links = true): string {
	return renderToStaticMarkup(createElement(NoteMarkdown, { text, links }));
}

test("renders ATX headings through h6", () => {
	const out = html("# h1\n## h2\n### h3\n#### h4\n##### h5\n###### h6");
	expect(out).toContain("<h1");
	expect(out).toContain("<h2");
	expect(out).toContain("<h3");
	expect(out).toContain("<h4");
	expect(out).toContain("<h5");
	expect(out).toContain("<h6");
	expect(out).toContain("note-md-h6");
});

test("renders rules, nested quotes, and lists with an offset start", () => {
	const out = html("***\n\n> outer\n>> inner\n\n- one\n  - nested\n\n57. foo\n1. bar");
	expect(out).toContain("note-md-hr");
	expect(out).toContain("note-md-quote");
	expect(out).toContain("nested");
	expect(out).toMatch(/<ol[^>]*start="57"/);
	expect(out).toMatch(/counter-reset:\s*note-md\s+56/);
});

test("keeps fenced and indented code as text and does not highlight it", () => {
	const out = html("``` js\nconst foo = 1;\n```\n\n    indented()");
	expect(out).toContain("<pre");
	expect(out).toContain("const foo = 1;");
	expect(out).toContain("indented()");
	expect(out).not.toContain("hljs");
	expect(out).not.toContain("language-js");
});

test("aligns table cells from the separator row", () => {
	const out = html("| A | B |\n| ---: | :---: |\n| 1 | 2 |");
	expect(out).toContain("note-md-table");
	expect(out).toMatch(/text-align:\s*right/);
	expect(out).toMatch(/text-align:\s*center/);
});

test("opens safe links, keeps a title, and shows image alt instead of fetching", () => {
	const out = html(
		'[text](https://example.com "title text!")\n\nhttps://example.com/auto\n\n![Minion](https://octodex.github.com/images/minion.png)',
	);
	expect(out).toContain('href="https://example.com/"');
	expect(out).toContain('title="title text!"');
	expect(out).toContain('href="https://example.com/auto"');
	expect(out).not.toContain("<img");
	expect(out).toContain("Minion");
	expect(out).not.toContain("octodex.github.com/images");
});

test("shows HTML as text and does not enable markdown-it plugins", () => {
	const out = html(
		"<script>alert(1)</script>\n\n19^th^\n\n++Inserted++\n\n==Marked==\n\n~~strike~~\n\n::: warning\nhere\n:::",
	);
	expect(out).toContain("&lt;script&gt;");
	expect(out).toContain("19^th^");
	expect(out).toContain("++Inserted++");
	expect(out).toContain("==Marked==");
	expect(out).toContain("<del");
	expect(out).toContain("strike");
	expect(out).not.toContain("<sub");
	expect(out).not.toContain("<sup");
	expect(out).not.toContain("<ins");
	expect(out).not.toContain("<mark");
	expect(out).not.toContain("<section");
});
