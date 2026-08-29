import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { SwUpdateChip } from "./sw-update-chip";

test("uses the cat mark and asks for a reload", () => {
	const html = renderToStaticMarkup(createElement(SwUpdateChip, { onReload: () => undefined }));
	expect(html).toContain("/marks/cat.svg");
	expect(html).toContain("A newer meownow");
	expect(html).toContain("Reload");
	expect(html).toContain('aria-label="Reload for a newer meownow"');
});
