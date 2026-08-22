export function contentSecurityPolicy(input: {
	nonce: string;
	isDev: boolean;
	edgeOrigin?: string;
	hubOrigin?: string;
}): string {
	const edge = connectSrc(input.edgeOrigin, input.hubOrigin);
	const evalSrc = input.isDev ? " 'unsafe-eval'" : "";
	const upgrade = input.isDev ? "" : " upgrade-insecure-requests;";
	return [
		`default-src 'self';`,
		`script-src 'nonce-${input.nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${evalSrc};`,
		`style-src 'self' 'unsafe-inline';`,
		`img-src 'self' blob: data:;`,
		`font-src 'self';`,
		`connect-src 'self'${edge};`,
		`worker-src 'self';`,
		`manifest-src 'self';`,
		`object-src 'none';`,
		`base-uri 'none';`,
		`form-action 'self';`,
		`frame-ancestors 'none';`,
		`require-trusted-types-for 'script';`,
		`trusted-types default nextjs nextjs#bundler goog#html wasm-js 'allow-duplicates';`,
		upgrade,
	]
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}

function connectSrc(...origins: Array<string | undefined>): string {
	const parts: string[] = [];
	const seen = new Set<string>();
	for (const origin of origins) {
		if (!origin) {
			continue;
		}
		let url: URL;
		try {
			url = new URL(origin);
		} catch {
			continue;
		}
		const ws = url.protocol === "https:" ? "wss:" : "ws:";
		const token = `${url.origin} ${ws}//${url.host}`;
		if (seen.has(token)) {
			continue;
		}
		seen.add(token);
		parts.push(token);
	}
	return parts.length === 0 ? "" : ` ${parts.join(" ")}`;
}
