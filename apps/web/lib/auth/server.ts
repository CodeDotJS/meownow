import { getWebEnv } from "../env";
import { DrizzleAuthStore } from "./drizzle-store";
import { createHandlers } from "./handlers";

export function authHandlers() {
	const env = getWebEnv();
	return createHandlers({ env, store: new DrizzleAuthStore(env.DATABASE_URL) });
}
