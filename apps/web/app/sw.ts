/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { saveIncomingShare } from "../lib/pwa/inbox";
import { sharePayloadFromForm } from "../lib/pwa/share";

declare global {
	interface WorkerGlobalScope extends SerwistGlobalConfig {
		__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
	}
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
	disableDevLogs: true,
	runtimeCaching: [
		{
			matcher({ url }) {
				return url.pathname.startsWith("/api/");
			},
			handler: new NetworkOnly(),
		},
		{
			matcher({ url }) {
				return url.pathname === "/upload" || url.pathname === "/dl" || url.pathname === "/stat";
			},
			handler: new NetworkOnly(),
		},
		...defaultCache,
	],
	fallbacks: {
		entries: [
			{
				url: "/~offline",
				matcher({ request }) {
					return request.destination === "document";
				},
			},
		],
	},
});

serwist.addEventListeners();

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);
	if (event.request.method === "POST" && url.pathname === "/share") {
		event.respondWith(handleShare(event.request));
	}
});

self.addEventListener("push", (event) => {
	let title = "New item";
	try {
		const data = event.data?.json() as { title?: unknown } | undefined;
		if (data && typeof data.title === "string") {
			title = data.title;
		}
	} catch {
		title = "New item";
	}
	event.waitUntil(self.registration.showNotification(title));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	event.waitUntil(self.clients.openWindow("/"));
});

async function handleShare(request: Request): Promise<Response> {
	const form = await request.formData();
	const payload = sharePayloadFromForm(form);
	if (payload) {
		await saveIncomingShare(payload);
	}
	return Response.redirect("/?shared=1", 303);
}
