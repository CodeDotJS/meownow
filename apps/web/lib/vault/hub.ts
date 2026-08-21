import {
	HUB_FANOUT_TTL_MS,
	type HubTicket,
	mintHubTicket,
	type WsEnvelope,
} from "@meownow/protocol";

export type HubPort = {
	publish: (userId: string, envelope: WsEnvelope) => Promise<void>;
};

export function silentHub(): HubPort {
	return { publish: async () => undefined };
}

export function createHttpHub(input: { edgeUrl?: string; hubSecret?: string }): HubPort {
	return {
		async publish(userId, envelope) {
			if (!input.edgeUrl || !input.hubSecret) {
				return;
			}
			const ticket = await mintHubTicket(input.hubSecret, {
				v: 1,
				purpose: "fanout",
				userId,
				exp: Date.now() + HUB_FANOUT_TTL_MS,
			});
			await fetch(`${input.edgeUrl.replace(/\/$/, "")}/fanout`, {
				method: "POST",
				headers: {
					authorization: `Bearer ${ticket}`,
					"content-type": "application/json",
				},
				body: JSON.stringify(envelope),
			});
		},
	};
}

export type { HubTicket };
