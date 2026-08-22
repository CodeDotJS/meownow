import { expect, test } from "vitest";
import { contentSecurityPolicy } from "./csp";

test("CSP uses a per-request nonce, strict-dynamic, and the required lock-downs", () => {
	const policy = contentSecurityPolicy({
		nonce: "abc123",
		isDev: false,
		edgeOrigin: "https://edge.meownow.example",
	});
	expect(policy).toContain("script-src 'nonce-abc123' 'strict-dynamic'");
	expect(policy).toContain("object-src 'none'");
	expect(policy).toContain("base-uri 'none'");
	expect(policy).toContain("frame-ancestors 'none'");
	expect(policy).toContain("require-trusted-types-for 'script'");
	expect(policy).toContain("trusted-types default nextjs nextjs#bundler");
	expect(policy).toContain("style-src 'self' 'unsafe-inline'");
	expect(policy).toContain("https://edge.meownow.example");
	expect(policy).toContain("wss://edge.meownow.example");
	expect(policy).toContain("'wasm-unsafe-eval'");
	expect(policy).not.toMatch(/(^| )'unsafe-eval'/);
});

test("dev CSP still allows JS eval for Next HMR", () => {
	const policy = contentSecurityPolicy({ nonce: "dev", isDev: true });
	expect(policy).toContain("'unsafe-eval'");
	expect(policy).toContain("'wasm-unsafe-eval'");
});
