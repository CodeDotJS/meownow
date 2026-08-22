"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/lib/ui/panel";
import { loadVault } from "@/lib/vault/idb";

export default function PairHubPage() {
	const [hasLocal, setHasLocal] = useState<boolean | null>(null);

	useEffect(() => {
		void loadVault().then((stored) => setHasLocal(stored !== null));
	}, []);

	if (hasLocal === null) {
		return (
			<main>
				<Panel>
					<h1>Pair</h1>
				</Panel>
			</main>
		);
	}

	if (hasLocal) {
		return (
			<main>
				<Panel>
					<h1>This browser already works</h1>
					<p className="lead">Point the camera at the QR on the new device.</p>
					<nav className="stack">
						<a className="select" href="/pair/scan">
							Scan
						</a>
					</nav>
					<p className="hint">
						This one is new? <a href="/pair/show">Show a code</a>
					</p>
				</Panel>
			</main>
		);
	}

	return (
		<main>
			<Panel>
				<h1>This browser is new</h1>
				<p className="lead">
					Show a code. On the phone or laptop that already works, tap Scan and type it.
				</p>
				<nav className="stack">
					<a className="select" href="/pair/show">
						Show a code
					</a>
				</nav>
				<p className="hint">
					This one already works? <a href="/pair/scan">Scan</a>
				</p>
			</Panel>
		</main>
	);
}
