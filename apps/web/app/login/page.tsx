"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";

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
			<h1>Login</h1>
			<button type="button" onClick={onLogin} disabled={busy}>
				Use passkey
			</button>
			{status ? <p className="status mono">{status}</p> : null}
		</main>
	);
}
