"use client";

import { type ReactNode, useEffect } from "react";

export function PwaSerwist({ children }: { children: ReactNode }) {
	useEffect(() => {
		if (process.env.NODE_ENV === "development") {
			return;
		}
		if (!("serviceWorker" in navigator)) {
			return;
		}
		void navigator.serviceWorker.register("/sw.js", { type: "classic", scope: "/" });
	}, []);
	return children;
}
