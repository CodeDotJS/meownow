export function contentSecurityPolicy(input: {
	nonce: string;
	isDev: boolean;
	edgeOrigin?: string;
}): string {
	const edge = connectSrc(input.edgeOrigin);
	const evalSrc = input.isDev ? " 'unsafe-eval'" : "";
	const upgrade = input.isDev ? "" : " upgrade-insecure-requests;";
	return [
		`default-src 'self';`,
		`script-src 'nonce-${input.nonce}' 'strict-dynamic'${evalSrc};`,
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

function connectSrc(edgeOrigin?: string): string {
	if (!edgeOrigin) {
		return "";
	}
	let url: URL;
	try {
		url = new URL(edgeOrigin);
	} catch {
		return "";
	}
	const ws = url.protocol === "https:" ? "wss:" : "ws:";
	return ` ${url.origin} ${ws}//${url.host}`;
}
