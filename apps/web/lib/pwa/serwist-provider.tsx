"use client";

import { type ReactNode, useEffect, useState } from "react";
import { SwUpdateChip } from "@/lib/ui/sw-update-chip";
import { watchSwUpdate } from "./sw-update";
import { swScriptUrl } from "./sw-url";

export function PwaSerwist({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false);

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
				.then((registration) => {
					if (cancelled) {
						return;
					}
					stop = watchSwUpdate(
						registration,
						Boolean(navigator.serviceWorker.controller),
						() => setReady(true),
						navigator.serviceWorker,
					);
				})
				.catch(() => undefined);
		} catch {
			return;
		}
		return () => {
			cancelled = true;
			stop();
		};
	}, []);

	return (
		<>
			{children}
			{ready ? <SwUpdateChip onReload={() => window.location.reload()} /> : null}
		</>
	);
}
