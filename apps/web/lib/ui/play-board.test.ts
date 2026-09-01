import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PlayBoard } from "./play-board";

test("playground copy does not say vault", () => {
	const html = renderToStaticMarkup(createElement(PlayBoard));
	expect(html.toLowerCase()).not.toContain("vault");
	expect(html).toContain("Five notes in this browser");
	expect(html).toContain("0/5");
	expect(html).toContain('aria-label="Image"');
	expect(html).not.toContain("of 5 in this browser");
	expect(html).not.toContain("That's five. Forget one");
});
