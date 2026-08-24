"use client";

import { type ReactNode, useEffect } from "react";
import { swScriptUrl } from "./sw-url";

export function PwaSerwist({ children }: { children: ReactNode }) {
	useEffect(() => {
		if (process.env.NODE_ENV === "development") {
			return;
		}
		if (!("serviceWorker" in navigator)) {
			return;
		}
		try {
			void navigator.serviceWorker
				.register(swScriptUrl() as string, { type: "classic", scope: "/" })
				.catch(() => undefined);
		} catch {
			return;
		}
	}, []);
	return children;
}
