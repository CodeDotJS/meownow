import type { WebEnv } from "@meownow/config/env";
import { parseWebEnv } from "@meownow/config/env";

export function getWebEnv(env: NodeJS.ProcessEnv = process.env): WebEnv {
	return parseWebEnv({
		DATABASE_URL: env.DATABASE_URL,
		APP_URL: env.APP_URL,
		SESSION_SECRET: env.SESSION_SECRET,
		ADMIN_ENROLL_SECRET: env.ADMIN_ENROLL_SECRET,
		SENTRY_DSN: env.SENTRY_DSN,
		VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
		CAPABILITY_TOKEN_PUBLIC_KEY: env.CAPABILITY_TOKEN_PUBLIC_KEY,
	});
}

export function rpFromAppUrl(appUrl: string): { origin: string; rpID: string; rpName: string } {
	const url = new URL(appUrl);
	return { origin: url.origin, rpID: url.hostname, rpName: "meownow" };
}
