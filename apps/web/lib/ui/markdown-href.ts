const ALLOWED = new Set(["http:", "https:", "mailto:"]);

/** Absolute http(s)/mailto only. Relative URLs would resolve to this origin. */
export function safeHref(href: string): string | null {
	const trimmed = href.trim();
	if (trimmed.length === 0) {
		return null;
	}
	try {
		const url = new URL(trimmed);
		if (!ALLOWED.has(url.protocol)) {
			return null;
		}
		if (url.protocol === "mailto:" && url.pathname.length === 0) {
			return null;
		}
		return url.href;
	} catch {
		return null;
	}
}
