export function inviteJoinUrl(origin: string, token: string): string {
	const url = new URL("/join", origin);
	url.searchParams.set("t", token);
	return url.toString();
}

/** Accept a raw token or a pasted /join?t= URL. */
export function parseInviteToken(raw: string): string {
	const trimmed = raw.trim();
	try {
		const url = new URL(trimmed);
		const token = url.searchParams.get("t");
		if (token) {
			return token;
		}
	} catch {
		// not a URL
	}
	const match = /(?:^|[?&])t=([^&]+)/.exec(trimmed);
	if (match?.[1]) {
		return decodeURIComponent(match[1]);
	}
	return trimmed;
}
