import { SESSION_SLIDING_MS } from "@meownow/db";

export const SESSION_COOKIE = "sid";
export const CHALLENGE_COOKIE = "wn";
export const CHALLENGE_MAX_AGE_SEC = 5 * 60;

export type CookieOptions = {
	httpOnly: boolean;
	secure: boolean;
	sameSite: "Lax";
	path: string;
	maxAge: number;
};

export function sessionCookieOptions(): CookieOptions {
	return {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_SLIDING_MS / 1000,
	};
}

export function challengeCookieOptions(): CookieOptions {
	return {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: CHALLENGE_MAX_AGE_SEC,
	};
}

export function serializeCookie(name: string, value: string, opts: CookieOptions): string {
	const parts = [
		`${name}=${value}`,
		`Path=${opts.path}`,
		`Max-Age=${opts.maxAge}`,
		`SameSite=${opts.sameSite}`,
	];
	if (opts.httpOnly) {
		parts.push("HttpOnly");
	}
	if (opts.secure) {
		parts.push("Secure");
	}
	return parts.join("; ");
}

export function expireCookie(name: string): string {
	return serializeCookie(name, "", { ...sessionCookieOptions(), maxAge: 0 });
}

export function readCookie(header: string | null, name: string): string | undefined {
	if (!header) {
		return undefined;
	}
	for (const part of header.split(";")) {
		const trimmed = part.trim();
		const eq = trimmed.indexOf("=");
		if (eq === -1) {
			continue;
		}
		if (trimmed.slice(0, eq) === name) {
			return trimmed.slice(eq + 1);
		}
	}
	return undefined;
}
