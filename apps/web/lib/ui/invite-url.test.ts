import { describe, expect, test } from "vitest";
import { inviteJoinUrl, parseInviteToken } from "./invite-url";

describe("inviteJoinUrl", () => {
	test("puts the token on /join", () => {
		expect(inviteJoinUrl("https://meownow.vercel.app", "abc_def")).toBe(
			"https://meownow.vercel.app/join?t=abc_def",
		);
	});

	test("pulls a token out of a pasted join URL", () => {
		expect(parseInviteToken("https://meownow.vercel.app/join?t=abc_def")).toBe("abc_def");
		expect(parseInviteToken("abc_def")).toBe("abc_def");
	});
});
