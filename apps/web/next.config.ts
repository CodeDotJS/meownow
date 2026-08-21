import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const revision =
	spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout.trim() || randomUUID();

const withSerwist = withSerwistInit({
	swSrc: "app/sw.ts",
	swDest: "public/sw.js",
	disable: process.env.NODE_ENV === "development",
	additionalPrecacheEntries: [
		{ url: "/", revision },
		{ url: "/~offline", revision },
	],
});

const nextConfig: NextConfig = {
	transpilePackages: [
		"@meownow/ui",
		"@meownow/protocol",
		"@meownow/config",
		"@meownow/db",
		"@meownow/crypto",
	],
	serverExternalPackages: [
		"@neondatabase/serverless",
		"ws",
		"bufferutil",
		"utf-8-validate",
		"web-push",
	],
};

export default withSerwist(nextConfig);
