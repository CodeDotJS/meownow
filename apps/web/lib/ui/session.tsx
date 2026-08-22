"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/client/http";
import { loadVault } from "@/lib/vault/idb";
import { dropStaleLocalVault } from "@/lib/vault/local";
import type { MenuMe } from "./menu";
import { Panel } from "./panel";

export function useBrowserSession() {
	const [ready, setReady] = useState(false);
	const [me, setMe] = useState<MenuMe | null>(null);
	const [hasLocal, setHasLocal] = useState(false);

	useEffect(() => {
		void (async () => {
			const res = await getJson("/api/auth/me");
			if (res.ok) {
				const profile = res.data as MenuMe & { hasVault: boolean };
				await dropStaleLocalVault(profile.hasVault);
				setMe(profile);
			} else {
				setMe(null);
			}
			setHasLocal((await loadVault()) !== null);
			setReady(true);
		})();
	}, []);

	return { ready, me, hasLocal };
}

export function AlreadyHere({
	title,
	lead,
	actionHref = "/",
	action = "Back to clipboard",
}: {
	title: string;
	lead: string;
	actionHref?: string;
	action?: string;
}) {
	return (
		<Panel>
			<h1>{title}</h1>
			<p className="lead">{lead}</p>
			<nav className="stack">
				<a className="select" href={actionHref}>
					{action}
				</a>
			</nav>
		</Panel>
	);
}

export function SessionLoading({ title }: { title: string }) {
	return (
		<Panel>
			<h1>{title}</h1>
			<p className="lead">Checking this browser.</p>
		</Panel>
	);
}
