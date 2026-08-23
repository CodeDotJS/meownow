"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import {
	preferRememberedPasskey,
	readRememberedPasskey,
	rememberPasskey,
	shouldRetryUsernameless,
	waitForSession,
} from "@/lib/client/passkey";
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
			const remembered = readRememberedPasskey();
			const first = await authenticatePasskey(remembered);
			const result =
				!first.ok && shouldRetryUsernameless(remembered, first.error)
					? await authenticatePasskey(null)
					: first;
			if (!result.ok) {
				setStatus(result.error === "unauthorized" ? "unverified" : result.error);
				return;
			}
			rememberPasskey(result.credentialId);
			await waitForSession(
				async () => (await getJson("/api/auth/me")).ok,
				(ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
			);
			window.location.assign(safeNextPath(new URL(window.location.href).searchParams.get("next")));
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

type AuthOk = { ok: true; credentialId: string };
type AuthFail = { ok: false; error: string };

async function authenticatePasskey(remembered: string | null): Promise<AuthOk | AuthFail> {
	const optionsRes = await postJson("/api/auth/login/options", {});
	if (!optionsRes.ok) {
		return { ok: false, error: errorCode(optionsRes.data) };
	}
	const payload = optionsRes.data as {
		options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
	};
	await new Promise<void>((resolve) => {
		window.setTimeout(resolve, 0);
	});
	const credential = await startAuthentication({
		optionsJSON: preferRememberedPasskey(payload.options, remembered),
	});
	const verifyRes = await postJson("/api/auth/login/verify", { credential });
	if (!verifyRes.ok) {
		return { ok: false, error: errorCode(verifyRes.data) };
	}
	return { ok: true, credentialId: credential.rawId || credential.id };
}
