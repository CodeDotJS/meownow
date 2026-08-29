"use client";

import type { MeResponse } from "@meownow/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { detectDeviceLabel } from "@/lib/client/device-label";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import { forgetPasskey } from "@/lib/client/passkey";
import { notesSyncedCopy } from "@/lib/ui/copy";
import { Panel } from "@/lib/ui/panel";
import { PixelAvatar } from "@/lib/ui/pixel-avatar";
import { AlreadyHere, SessionLoading, useBrowserSession } from "@/lib/ui/session";
import { Status } from "@/lib/ui/status";
import { setSyncEnabled } from "@/lib/vault/flush";
import { clearVault } from "@/lib/vault/idb";
import { clearItemCache, getItemCacheMeta, setItemCacheMeta } from "@/lib/vault/item-cache";

export default function AccountPage() {
	const { ready, me } = useBrowserSession();
	const [profile, setProfile] = useState<MeResponse | null>(null);
	const [deviceLabel, setDeviceLabel] = useState("");
	const [confirm, setConfirm] = useState("");
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [syncEnabled, setSyncOn] = useState(true);
	const [clipLongNotes, setClipLongNotes] = useState(false);
	const [tapNoteToCopy, setTapNoteToCopy] = useState(false);
	const [tabIndent, setTabIndent] = useState(true);

	useEffect(() => {
		void getItemCacheMeta().then((meta) => {
			setSyncOn(meta.syncEnabled);
			setClipLongNotes(meta.clipLongNotes);
			setTapNoteToCopy(meta.tapNoteToCopy);
			setTabIndent(meta.tabIndent);
		});
	}, []);

	useEffect(() => {
		if (!me) {
			return;
		}
		void (async () => {
			const res = await getJson("/api/auth/me");
			if (!res.ok) {
				return;
			}
			setProfile(res.data as MeResponse);
		})();
		void detectDeviceLabel().then(setDeviceLabel);
	}, [me]);

	if (!ready) {
		return (
			<main>
				<SessionLoading title="Account" />
			</main>
		);
	}
	if (!me) {
		return (
			<main>
				<AlreadyHere
					title="Sign in first"
					lead="Account lives on a signed-in browser."
					actionHref="/login"
					action="Sign in"
				/>
			</main>
		);
	}

	const handle = profile?.handle ?? me.handle;
	const displayName = profile?.displayName ?? me.handle;

	async function onSyncToggle(enabled: boolean) {
		setSyncOn(enabled);
		setStatus(null);
		const result = await setSyncEnabled(enabled);
		if (!enabled) {
			return;
		}
		if (result.flushed > 0) {
			setStatus(notesSyncedCopy(result.flushed));
		} else if (result.error) {
			setStatus(result.error === "offline" ? "sync_needs_network" : result.error);
		}
	}

	async function onTrayPref(patch: {
		clipLongNotes?: boolean;
		tapNoteToCopy?: boolean;
		tabIndent?: boolean;
	}) {
		if (patch.clipLongNotes !== undefined) {
			setClipLongNotes(patch.clipLongNotes);
		}
		if (patch.tapNoteToCopy !== undefined) {
			setTapNoteToCopy(patch.tapNoteToCopy);
		}
		if (patch.tabIndent !== undefined) {
			setTabIndent(patch.tabIndent);
		}
		const meta = await getItemCacheMeta();
		await setItemCacheMeta({ ...meta, ...patch });
	}

	async function onDelete(event: FormEvent) {
		event.preventDefault();
		if (confirm !== handle) {
			setStatus("Type your username exactly to confirm.");
			return;
		}
		setBusy(true);
		setStatus(null);
		try {
			const res = await postJson("/api/auth/account/delete", { handle });
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
			forgetPasskey();
			await clearVault();
			await clearItemCache();
			window.location.href = "/";
		} catch {
			setStatus("request_failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main>
			<Panel>
				<div className="account-head">
					<PixelAvatar label={handle} size={56} />
					<div>
						<h1>{handle}</h1>
						<p className="lead">{displayName === handle ? "Your account." : displayName}</p>
					</div>
				</div>
				{deviceLabel ? <p className="dir-meta">This browser is {deviceLabel}.</p> : null}
				<section className="account-sync">
					<h2>Sync</h2>
					<p>Off keeps new notes on this browser until you sync them.</p>
					<label className="ack">
						<input
							className="ack-box"
							type="checkbox"
							checked={syncEnabled}
							onChange={(event) => void onSyncToggle(event.target.checked)}
						/>
						Sync to other devices
					</label>
				</section>
				<section className="account-sync">
					<h2>Clipboard</h2>
					<p>These stay on this browser.</p>
					<label className="ack">
						<input
							className="ack-box"
							type="checkbox"
							checked={clipLongNotes}
							onChange={(event) => void onTrayPref({ clipLongNotes: event.target.checked })}
						/>
						Clip long notes
					</label>
					<label className="ack">
						<input
							className="ack-box"
							type="checkbox"
							checked={tapNoteToCopy}
							onChange={(event) => void onTrayPref({ tapNoteToCopy: event.target.checked })}
						/>
						Tap a note to copy
					</label>
					<label className="ack">
						<input
							className="ack-box"
							type="checkbox"
							checked={tabIndent}
							onChange={(event) => void onTrayPref({ tabIndent: event.target.checked })}
						/>
						Tab indents
					</label>
				</section>
				<form className="account-leave" onSubmit={(event) => void onDelete(event)}>
					<h2>Delete account</h2>
					<p>
						Removes you, every device, and the sealed items you posted. Other people keep theirs.
						Type <span className="mono">{handle}</span> to confirm.
					</p>
					<label>
						Username
						<input
							value={confirm}
							onChange={(event) => setConfirm(event.target.value)}
							autoComplete="username"
							spellCheck={false}
							required
						/>
					</label>
					<button className="select" type="submit" disabled={busy || confirm !== handle}>
						{busy ? "Working…" : "Delete account"}
					</button>
					<Status value={status} />
				</form>
			</Panel>
		</main>
	);
}
