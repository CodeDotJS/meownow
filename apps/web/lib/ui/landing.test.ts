import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Landing } from "./landing";

function hero(hasLocal: boolean): string {
	return renderToStaticMarkup(createElement(Landing, { hasLocal }));
}

test("signed-out home always shows playground and passkey together", () => {
	for (const html of [hero(false), hero(true)]) {
		expect(html).toContain('class="select" href="/play"');
		expect(html).toContain("Playground");
		expect(html).toContain('class="select" href="/login"');
		expect(html).toContain("Continue with passkey");
	}
});
