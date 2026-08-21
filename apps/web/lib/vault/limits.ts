import { AUTH_LIMIT_USER_ID, HUB_LIMIT_TTL_MS, mintHubTicket } from "@meownow/protocol";

export type LimitPort = {
	take: (bucket: "send" | "auth", key: string) => Promise<boolean>;
};

export function silentLimits(): LimitPort {
	return { take: async () => true };
}

export function createHttpLimits(input: { edgeUrl?: string; hubSecret?: string }): LimitPort {
	return {
		async take(bucket, key) {
			if (!input.edgeUrl || !input.hubSecret) {
				return true;
			}
			const userId = bucket === "send" ? key : AUTH_LIMIT_USER_ID;
			const ticket = await mintHubTicket(input.hubSecret, {
				v: 1,
				purpose: "limit",
				userId,
				exp: Date.now() + HUB_LIMIT_TTL_MS,
			});
			const res = await fetch(`${input.edgeUrl.replace(/\/$/, "")}/limit`, {
				method: "POST",
				headers: {
					authorization: `Bearer ${ticket}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({ bucket, key }),
			});
			return res.status !== 429;
		},
	};
}
