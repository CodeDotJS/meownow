"use client";

import { type ReactNode, useEffect, useState } from "react";
import { SwUpdateChip } from "@/lib/ui/sw-update-chip";
import { reloadForSwUpdate, takeSwReloaded, watchSwUpdate } from "./sw-update";
import { swScriptUrl } from "./sw-url";

export function PwaSerwist({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false);
	const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

	useEffect(() => {
		if (process.env.NODE_ENV === "development") {
			return;
		}
		if (!("serviceWorker" in navigator)) {
			return;
		}
		let cancelled = false;
		let stop: () => void = () => undefined;
		try {
			void navigator.serviceWorker
				.register(swScriptUrl() as string, { type: "classic", scope: "/" })
				.then((next) => {
					if (cancelled) {
						return;
					}
					setRegistration(next);
					stop = watchSwUpdate(
						next,
						Boolean(navigator.serviceWorker.controller),
						() => setReady(true),
						navigator.serviceWorker,
						{ ignoreCurrent: takeSwReloaded() },
					);
				})
				.catch(() => undefined);
		} catch {
			return;
		}
		const onShow = (event: PageTransitionEvent) => {
			if (event.persisted) {
				setReady(false);
			}
		};
		window.addEventListener("pageshow", onShow);
		return () => {
			cancelled = true;
			stop();
			window.removeEventListener("pageshow", onShow);
		};
	}, []);

	return (
		<>
			{children}
			{ready ? (
				<SwUpdateChip
					onReload={() => {
						if (registration) {
							reloadForSwUpdate(registration);
							return;
						}
						window.location.reload();
					}}
				/>
			) : null}
		</>
	);
}
