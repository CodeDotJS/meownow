"use client";

import { SerwistProvider } from "@serwist/next/react";
import type { ReactNode } from "react";

export function PwaSerwist({ children }: { children: ReactNode }) {
	return (
		<SerwistProvider
			swUrl="/sw.js"
			disable={process.env.NODE_ENV === "development"}
			reloadOnOnline={false}
			options={{ type: "classic" }}
		>
			{children}
		</SerwistProvider>
	);
}
