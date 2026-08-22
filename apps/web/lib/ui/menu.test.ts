import { describe, expect, test } from "vitest";
import { type MenuMe, menuActions } from "./menu";

const member: MenuMe = {
	handle: "rishi",
	role: "member",
	canUpload: true,
	hasVault: true,
};

describe("menuActions", () => {
	test("guest menu is onboarding, not the product", () => {
		const ids = menuActions(null, false).map((row) => row.id);
		expect(ids).toEqual(["login", "join", "pair", "recover", "enroll"]);
	});

	test("a browser that already has keys only offers sign in", () => {
		expect(menuActions(null, true).map((row) => row.id)).toEqual(["login"]);
	});

	test("a working signed-in browser does not offer recover, join, or enroll", () => {
		const ids = menuActions(member, true).map((row) => row.id);
		expect(ids).toEqual(["home", "add-device", "pair", "logout"]);
		expect(ids).not.toContain("recover");
		expect(ids).not.toContain("join");
		expect(ids).not.toContain("enroll");
	});

	test("a signed-in new browser keeps recover as a last resort", () => {
		const ids = menuActions(member, false).map((row) => row.id);
		expect(ids[0]).toBe("home");
		expect(ids[1]).toBe("pair");
		expect(ids).toContain("recover");
		expect(ids).not.toContain("join");
		expect(ids).not.toContain("enroll");
	});

	test("setup is the only path before the 12 words exist", () => {
		expect(menuActions({ ...member, hasVault: false }, false).map((row) => row.id)).toEqual([
			"setup",
			"logout",
		]);
	});
});
