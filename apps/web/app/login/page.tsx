"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import {
	forgetPasskey,
	preferRememberedPasskey,
	readRememberedPasskey,
	rememberPasskey,
	shouldForgetPasskey,
	waitForSession,
} from "@/lib/client/passkey";
import { Panel } from "@/lib/ui/panel";
import { safeNextPath } from "@/lib/ui/safe-next";
import { AlreadyHere, SessionLoading, useBrowserSession } from "@/lib/ui/session";
import { Status } from "@/lib/ui/status";

type LoginOptions = Parameters<typeof startAuthentication>[0]["optionsJSON"];

type Prepared = {
	options: LoginOptions;
	challenge: string;
};

export default function LoginPage() {
	const { ready, me, hasLocal } = useBrowserSession();
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [warming, setWarming] = useState(true);
	const [prepared, setPrepared] = useState(false);
	const preparedRef = useRef<Prepared | null>(null);
	const preparingRef = useRef<Promise<Prepared | null> | null>(null);

	const loadChallenge = useCallback(async () => {
		if (preparingRef.current) {
			return preparingRef.current;
		}
		const work = (async () => {
			const res = await postJson("/api/auth/login/options", {});
			if (!res.ok) {
				preparedRef.current = null;
				setPrepared(false);
				return null;
			}
			const data = res.data as { options: LoginOptions; challenge?: string };
			const next = { options: data.options, challenge: data.challenge ?? "" };
			preparedRef.current = next;
			setPrepared(true);
			return next;
		})();
		preparingRef.current = work;
		try {
			return await work;
		} finally {
			if (preparingRef.current === work) {
				preparingRef.current = null;
			}
		}
	}, []);

	useEffect(() => {
		if (!ready || me) {
			return;
		}
		setWarming(true);
		void loadChallenge().finally(() => setWarming(false));
	}, [ready, me, loadChallenge]);

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
			const readyChallenge = preparedRef.current ?? (await loadChallenge());
			if (!readyChallenge) {
				setStatus("request_failed");
				return;
			}
			preparedRef.current = null;
			setPrepared(false);
			const remembered = readRememberedPasskey();
			const credential = await startAuthentication({
				optionsJSON: preferRememberedPasskey(readyChallenge.options, remembered),
			});
			const verifyRes = await postJson("/api/auth/login/verify", {
				credential,
				...(readyChallenge.challenge ? { challenge: readyChallenge.challenge } : {}),
			});
			void loadChallenge();
			if (!verifyRes.ok) {
				const failed = errorCode(verifyRes.data);
				if (shouldForgetPasskey(failed)) {
					forgetPasskey();
				}
				setStatus(failed === "unauthorized" ? "unverified" : failed);
				return;
			}
			rememberPasskey(credential.rawId || credential.id);
			await waitForSession(
				async () => (await getJson("/api/auth/me")).ok,
				(ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
			);
			window.location.assign(safeNextPath(new URL(window.location.href).searchParams.get("next")));
		} catch (err) {
			void loadChallenge();
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
					<button
						className="select"
						type="button"
						onClick={onLogin}
						disabled={busy || (warming && !prepared)}
					>
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
