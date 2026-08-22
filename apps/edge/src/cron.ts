import {
	AUTH_LIMIT_USER_ID,
	HUB_LIMIT_TTL_MS,
	mintHubTicket,
	pruneResponseSchema,
} from "@meownow/protocol";
import { sweepOrphans } from "./prune";

export type CronEnv = {
	HUB_SECRET: string;
	APP_URL: string;
	BLOBS: Parameters<typeof sweepOrphans>[0];
};

export async function runCron(env: CronEnv): Promise<void> {
	const ticket = await mintHubTicket(env.HUB_SECRET, {
		v: 1,
		purpose: "cron",
		userId: AUTH_LIMIT_USER_ID,
		exp: Date.now() + HUB_LIMIT_TTL_MS,
	});
	const res = await fetch(`${env.APP_URL.replace(/\/$/, "")}/api/internal/prune`, {
		method: "POST",
		headers: { authorization: `Bearer ${ticket}` },
	});
	if (!res.ok) {
		console.error(`prune_http_${res.status}`);
		return;
	}
	const parsed = pruneResponseSchema.safeParse(await res.json().catch(() => null));
	if (!parsed.success) {
		return;
	}
	await sweepOrphans(env.BLOBS, new Set(parsed.data.keepR2Keys));
}
