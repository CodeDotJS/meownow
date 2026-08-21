import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@meownow/ui", "@meownow/protocol", "@meownow/config"],
};

export default nextConfig;
