import { getWebEnv } from "../env";
import { createHttpHub } from "../vault/hub";
import { DrizzleAuthStore } from "./drizzle-store";
import { createHandlers } from "./handlers";

export function authHandlers() {
	const env = getWebEnv();
	return createHandlers({
		env,
		store: new DrizzleAuthStore(env.DATABASE_URL),
		hub: createHttpHub({ edgeUrl: env.EDGE_URL, hubSecret: env.HUB_SECRET }),
	});
}
