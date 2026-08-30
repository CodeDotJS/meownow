import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PlayCapDialog } from "./play-cap-dialog";

test("cap sheet asks for an invite and does not say vault", () => {
	const html = renderToStaticMarkup(
		createElement(PlayCapDialog, { open: true, onClose: () => undefined }),
	);
	expect(html).toContain("/marks/cat.svg");
	expect(html).toContain("play-cap-title");
	expect(html).toMatch(/That.+s five/);
	expect(html).toContain("Ask for an invite");
	expect(html).toContain('href="/ask"');
	expect(html).toContain('href="/join"');
	expect(html.toLowerCase()).not.toContain("vault");
});

test("closed cap sheet renders nothing", () => {
	expect(
		renderToStaticMarkup(createElement(PlayCapDialog, { open: false, onClose: () => undefined })),
	).toBe("");
});
