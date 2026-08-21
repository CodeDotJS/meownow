import { getWebEnv } from "../env";
import { createHttpHub } from "../vault/hub";
import { createWebPush } from "../vault/push";
import { DrizzleAuthStore } from "./drizzle-store";
import { createHandlers } from "./handlers";

export function authHandlers() {
	const env = getWebEnv();
	const store = new DrizzleAuthStore(env.DATABASE_URL);
	return createHandlers({
		env,
		store,
		hub: createHttpHub({ edgeUrl: env.EDGE_URL, hubSecret: env.HUB_SECRET }),
		push: createWebPush(env, store),
	});
}
