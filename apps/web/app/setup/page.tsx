"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/client/http";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";
import { bootstrapVault } from "@/lib/vault/bootstrap";
import { loadVault } from "@/lib/vault/idb";

type Me = { id: string; handle: string; hasVault: boolean };

export default function SetupPage() {
	const [mnemonic, setMnemonic] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void (async () => {
			const local = await loadVault();
			if (local) {
				window.location.href = "/";
			}
		})();
	}, []);

	async function onCreate() {
		setBusy(true);
		setStatus(null);
		try {
			const me = await getJson("/api/auth/me");
			if (!me.ok) {
				window.location.href = "/login";
				return;
			}
			const profile = me.data as Me;
			if (profile.hasVault) {
				setStatus("vault_exists");
				return;
			}
			const phrase = await bootstrapVault(profile.id);
			setMnemonic(phrase);
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "vault_failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main>
			<Panel>
				<h1>Vault</h1>
				{mnemonic ? (
					<>
						<p className="lead">Write these 12 words down. They are shown once.</p>
						<p className="phrase">{mnemonic}</p>
						<nav className="stack">
							<a className="select" href="/">
								Done
							</a>
						</nav>
					</>
				) : (
					<>
						<p className="lead">
							Generate a vault key on this device. The server stores ciphertext only.
						</p>
						<nav className="stack">
							<button
								className="select"
								type="button"
								onClick={() => void onCreate()}
								disabled={busy}
							>
								Create vault
							</button>
						</nav>
					</>
				)}
				<Status value={status} />
			</Panel>
		</main>
	);
}
