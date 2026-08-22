"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/lib/ui/panel";
import { loadVault } from "@/lib/vault/idb";

export default function PairHubPage() {
	const [hasLocal, setHasLocal] = useState<boolean | null>(null);

	useEffect(() => {
		void loadVault().then((stored) => setHasLocal(stored !== null));
	}, []);

	const showCard = (
		<a className="pair-card" href="/pair/show" key="show">
			<h2>Show a code</h2>
			<p>This browser is new. It shows a code and a QR for the one that already works.</p>
			{hasLocal === false ? <span className="pair-tag">Start here</span> : null}
		</a>
	);

	const addCard = (
		<a className="pair-card" href="/pair/scan" key="add">
			<h2>Add a device</h2>
			<p>This browser already works. Type the code the new browser is showing.</p>
			{hasLocal === true ? <span className="pair-tag">Start here</span> : null}
		</a>
	);

	return (
		<main>
			<Panel>
				<h1>Add a device</h1>
				<p className="lead">
					One browser shows a code. The other types it. Pick what this browser is doing.
				</p>
				<div className="pair-choice">{hasLocal ? [addCard, showCard] : [showCard, addCard]}</div>
				{hasLocal === false ? (
					<p className="hint">
						Lost every device? <a href="/recover">Use the 12 words</a>
					</p>
				) : null}
			</Panel>
		</main>
	);
}
