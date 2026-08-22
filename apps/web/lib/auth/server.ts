import { getWebEnv } from "../env";
import { createHttpBlobs } from "../vault/blobs";
import { createHttpHub, hubOrigin } from "../vault/hub";
import { createHttpLimits } from "../vault/limits";
import { createWebPush } from "../vault/push";
import { DrizzleAuthStore } from "./drizzle-store";
import { createHandlers } from "./handlers";

export function authHandlers() {
	const env = getWebEnv();
	const store = new DrizzleAuthStore(env.DATABASE_URL);
	return createHandlers({
		env,
		store,
		hub: createHttpHub({ edgeUrl: hubOrigin(env), hubSecret: env.HUB_SECRET }),
		push: createWebPush(env, store),
		blobs: createHttpBlobs(env.EDGE_URL),
		limits: createHttpLimits({ edgeUrl: hubOrigin(env), hubSecret: env.HUB_SECRET }),
	});
}
