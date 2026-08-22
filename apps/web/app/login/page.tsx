"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";
import { Panel } from "@/lib/ui/panel";
import { safeNextPath } from "@/lib/ui/safe-next";
import { AlreadyHere, SessionLoading, useBrowserSession } from "@/lib/ui/session";
import { Status } from "@/lib/ui/status";

export default function LoginPage() {
	const { ready, me, hasLocal } = useBrowserSession();
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	if (!ready) {
		return (
			<main>
				<SessionLoading title="Sign in" />
			</main>
		);
	}
	if (me) {
		return (
			<main>
				<AlreadyHere title="You're already in" lead={`Signed in as ${me.handle}.`} />
			</main>
		);
	}

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
			window.location.href = safeNextPath(new URL(window.location.href).searchParams.get("next"));
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "passkey_failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main>
			<Panel>
				<h1>Sign in</h1>
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
				</p>
				{hasLocal ? (
					<p className="hint">This browser already has the clipboard.</p>
				) : (
					<ul className="hint-list">
						<li>
							New here? You need an <a href="/join">invite link</a>
						</li>
						<li>
							Adding this browser? <a href="/pair/show">Show a code</a>
						</li>
						<li>
							Lost every device. <a href="/recover">Use the 12 words</a>
						</li>
						<li>
							First seat? <a href="/enroll">First admin</a>
						</li>
					</ul>
				)}
			</Panel>
		</main>
	);
}
