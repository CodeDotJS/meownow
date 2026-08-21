"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

export default function LoginPage() {
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function onLogin() {
		setBusy(true);
		setStatus(null);
		try {
			const optionsRes = await postJson("/api/auth/login/options", {});
			if (!optionsRes.ok) {
				setStatus(errorCode(optionsRes.data));
				return;
			}
			const payload = optionsRes.data as {
				options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
			};
			const credential = await startAuthentication({ optionsJSON: payload.options });
			const verifyRes = await postJson("/api/auth/login/verify", { credential });
			if (!verifyRes.ok) {
				setStatus(errorCode(verifyRes.data));
				return;
			}
			window.location.href = "/";
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "passkey_failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main>
			<Panel>
				<h1>Login</h1>
				<p className="lead">Face ID, Touch ID, or your device passkey. No password.</p>
				<nav className="stack">
					<button className="select" type="button" onClick={onLogin} disabled={busy}>
						{busy ? "Working…" : "Continue with passkey"}
					</button>
				</nav>
				<Status value={status} />
				<p className="hint">
					This only unlocks a passkey already saved on this browser. A passkey from
					meownow.vercel.app will not appear here.
					<br />
					New here? You need an invite link.
				</p>
			</Panel>
		</main>
	);
}
