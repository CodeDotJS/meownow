import { expect, test } from "vitest";
import {
	CHALLENGE_COOKIE,
	expireCookie,
	readCookie,
	SESSION_COOKIE,
	serializeCookie,
	sessionCookieOptions,
} from "./cookies";

test("session cookie is httpOnly Secure SameSite=Lax Path=/", () => {
	const cookie = serializeCookie("sid", "token", sessionCookieOptions());
	expect(cookie).toContain("HttpOnly");
	expect(cookie).toContain("Secure");
	expect(cookie).toContain("SameSite=Lax");
	expect(cookie).toContain("Path=/");
	expect(cookie.toLowerCase()).not.toContain("samesite=none");
});

test("readCookie finds sid among multiple cookies", () => {
	expect(readCookie("wn=abc; sid=tok", SESSION_COOKIE)).toBe("tok");
	expect(readCookie(null, SESSION_COOKIE)).toBeUndefined();
});

test("expireCookie clears the challenge cookie", () => {
	expect(expireCookie(CHALLENGE_COOKIE)).toContain("Max-Age=0");
});
