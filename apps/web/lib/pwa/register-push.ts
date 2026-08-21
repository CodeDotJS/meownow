import { getJson, postJson } from "../client/http";

export async function registerPush(): Promise<void> {
	if (
		!("serviceWorker" in navigator) ||
		!("PushManager" in window) ||
		!("Notification" in window)
	) {
		return;
	}
	const existingReg = await navigator.serviceWorker.getRegistration();
	if (!existingReg) {
		return;
	}
	const vapid = await getJson("/api/push/vapid");
	if (!vapid.ok) {
		return;
	}
	const publicKey = (vapid.data as { publicKey: string }).publicKey;
	if (Notification.permission === "denied") {
		return;
	}
	const permission =
		Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
	if (permission !== "granted") {
		return;
	}
	const registration = await navigator.serviceWorker.ready;
	const existing = await registration.pushManager.getSubscription();
	const subscription =
		existing ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(publicKey).buffer,
		}));
	const json = subscription.toJSON();
	const p256dh = json.keys?.p256dh;
	const auth = json.keys?.auth;
	if (!json.endpoint || !p256dh || !auth) {
		return;
	}
	await postJson("/api/push/subscribe", {
		endpoint: json.endpoint,
		keys: { p256dh, auth },
	});
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/");
	const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
	const bin = atob(padded + pad);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i += 1) {
		out[i] = bin.charCodeAt(i);
	}
	return out;
}
