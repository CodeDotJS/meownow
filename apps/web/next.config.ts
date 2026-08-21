import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@meownow/ui", "@meownow/protocol", "@meownow/config", "@meownow/db"],
	serverExternalPackages: ["@neondatabase/serverless", "ws"],
};

export default nextConfig;
