import { expect, test } from "vitest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { SITE_DESCRIPTION, SITE_URL } from "./site";

test("keeps the public origin and a short description", () => {
	expect(SITE_URL).toMatch(/^https:\/\//);
	expect(SITE_DESCRIPTION).toMatch(/copy on one device/i);
	expect(SITE_DESCRIPTION.toLowerCase()).not.toContain("vault");
});

test("does not invite crawlers into account or pairing", () => {
	const rules = robots().rules;
	const list = Array.isArray(rules) ? rules[0] : rules;
	expect(list?.disallow).toEqual(expect.arrayContaining(["/account", "/pair", "/join", "/api/"]));
	expect(sitemap().map((row) => row.url)).toEqual([SITE_URL, `${SITE_URL}/about`]);
});
