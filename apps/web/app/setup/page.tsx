"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/client/http";
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
			<h1>Vault</h1>
			{mnemonic ? (
				<>
					<p>Write these 12 words down. They are shown once.</p>
					<p className="mono">{mnemonic}</p>
					<a href="/">Done</a>
				</>
			) : (
				<>
					<p>Generate a vault key on this device. The server stores only ciphertext.</p>
					<button type="button" onClick={() => void onCreate()} disabled={busy}>
						Create vault
					</button>
				</>
			)}
			{status ? <p className="status mono">{status}</p> : null}
		</main>
	);
}
