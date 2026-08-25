"use client";

import { useEffect, useState } from "react";
import type { MenuMe } from "./menu";
import { Panel } from "./panel";
import { asMenuMe, hydrateBrowserSession, peekBrowserSession } from "./session-cache";

export function useBrowserSession() {
	const peeked = peekBrowserSession();
	const [ready, setReady] = useState(() => peeked !== null);
	const [me, setMe] = useState<MenuMe | null>(() => (peeked?.me ? asMenuMe(peeked.me) : null));
	const [hasLocal, setHasLocal] = useState(() => peeked?.hasLocal ?? false);

	useEffect(() => {
		void (async () => {
			const session = await hydrateBrowserSession();
			setMe(session.me ? asMenuMe(session.me) : null);
			setHasLocal(session.hasLocal);
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
