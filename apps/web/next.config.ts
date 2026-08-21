import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: [
		"@meownow/ui",
		"@meownow/protocol",
		"@meownow/config",
		"@meownow/db",
		"@meownow/crypto",
	],
	serverExternalPackages: ["@neondatabase/serverless", "ws"],
};

export default nextConfig;
