"use client";

import { useEffect, useState } from "react";
import { getJson, postJson } from "@/lib/client/http";
import { bootstrapVault } from "@/lib/vault/bootstrap";
import { dropStaleLocalVault } from "@/lib/vault/local";
import { Panel } from "./panel";
import { Status } from "./status";

type Me = { id: string; hasVault: boolean };

export function CreateVaultFlow({ onComplete }: { onComplete: () => void }) {
	const [mnemonic, setMnemonic] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [ack, setAck] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const me = await getJson("/api/auth/me");
			if (!me.ok) {
				window.location.href = "/login";
				return;
			}
			const profile = me.data as Me;
			await dropStaleLocalVault(profile.hasVault);
			if (cancelled) {
				return;
			}
			if (profile.hasVault) {
				window.location.replace("/");
			}
		})();
		return () => {
			cancelled = true;
		};
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
			await dropStaleLocalVault(profile.hasVault);
			if (profile.hasVault) {
				window.location.replace("/");
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
		<Panel>
			<h1>{mnemonic ? "Write these down" : "Set up this device"}</h1>
			{mnemonic ? (
				<>
					<p className="lead">
						Twelve recovery words. They are shown once. Anyone with them can read this clipboard.
					</p>
					<p className="phrase">{mnemonic}</p>
					<label className="ack">
						<input
							className="ack-box"
							type="checkbox"
							checked={ack}
							onChange={(event) => setAck(event.target.checked)}
						/>
						I wrote them down
					</label>
					<nav className="stack">
						<button className="select" type="button" disabled={!ack} onClick={onComplete}>
							Continue
						</button>
					</nav>
				</>
			) : (
				<>
					<p className="lead">
						This browser will hold the keys. The next screen shows 12 words so you can get them back
						if you lose the device.
					</p>
					<nav className="stack">
						<button
							className="select"
							type="button"
							onClick={() => void onCreate()}
							disabled={busy}
						>
							{busy ? "Working…" : "Show the 12 words"}
						</button>
					</nav>
					{busy ? (
						<p className="hint" role="status">
							Stay on this page. This takes a few seconds.
						</p>
					) : (
						<p className="hint">
							<button
								type="button"
								onClick={() => {
									void postJson("/api/auth/logout", {}).then(() => {
										window.location.href = "/";
									});
								}}
							>
								Log out
							</button>
						</p>
					)}
				</>
			)}
			<Status value={status} />
		</Panel>
	);
}
