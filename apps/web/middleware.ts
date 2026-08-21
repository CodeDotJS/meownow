import { type NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "./lib/csp";

export function middleware(request: NextRequest) {
	const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
	const policy = contentSecurityPolicy({
		nonce,
		isDev: process.env.NODE_ENV !== "production",
		edgeOrigin: process.env.EDGE_URL,
	});
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-nonce", nonce);
	requestHeaders.set("Content-Security-Policy", policy);
	const response = NextResponse.next({ request: { headers: requestHeaders } });
	response.headers.set("Content-Security-Policy", policy);
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set("Referrer-Policy", "no-referrer");
	response.headers.set(
		"Permissions-Policy",
		`${cameraPolicy(request.nextUrl.pathname)}, microphone=(), geolocation=()`,
	);
	return response;
}

function cameraPolicy(pathname: string): string {
	return pathname === "/pair/scan" ? "camera=(self)" : "camera=()";
}

export const config = {
	matcher: [
		{
			source: "/((?!api|_next/static|_next/image|sw.js|icons/).*)",
			missing: [
				{ type: "header", key: "next-router-prefetch" },
				{ type: "header", key: "purpose", value: "prefetch" },
			],
		},
	],
};
