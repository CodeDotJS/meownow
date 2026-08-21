import type { WebEnv } from "@meownow/config/env";
import type { VaultStore } from "./store";

export type PushPort = {
	notify: (input: { userId: string; exceptDeviceId: string; title: string }) => Promise<void>;
};

export function silentPush(): PushPort {
	return { notify: async () => undefined };
}

export function createWebPush(env: WebEnv, store: VaultStore): PushPort {
	return {
		async notify(input) {
			if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
				return;
			}
			const webpush = await import("web-push");
			webpush.setVapidDetails(
				env.VAPID_SUBJECT ?? env.APP_URL,
				env.VAPID_PUBLIC_KEY,
				env.VAPID_PRIVATE_KEY,
			);
			const subs = await store.listPushSubscriptions(input.userId, input.exceptDeviceId);
			const payload = JSON.stringify({ title: input.title });
			for (const sub of subs) {
				try {
					await webpush.sendNotification(
						{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
						payload,
					);
				} catch (err) {
					const status = (err as { statusCode?: number }).statusCode;
					if (status === 404 || status === 410) {
						await store.deletePushSubscription(sub.endpoint);
					}
				}
			}
		},
	};
}
