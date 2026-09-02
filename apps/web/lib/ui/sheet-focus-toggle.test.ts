import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { SheetFocusToggle } from "./sheet-focus-toggle";

test("chip names the current panes and the next tap", () => {
	const html = renderToStaticMarkup(
		createElement(SheetFocusToggle, { focus: "both", onChange: () => undefined }),
	);
	expect(html).toContain("Both panes. Next: Write only");
	expect(html).not.toContain("composer-icon is-on");
});

test("write-only chip is on and points at the tray", () => {
	const html = renderToStaticMarkup(
		createElement(SheetFocusToggle, { focus: "write", onChange: () => undefined }),
	);
	expect(html).toContain("composer-icon is-on");
	expect(html).toContain("Write only. Next: Tray only");
});
