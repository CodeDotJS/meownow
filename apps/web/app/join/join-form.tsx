"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { type FormEvent, useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";

export function JoinForm({ initialToken }: { initialToken: string }) {
	const [token, setToken] = useState(initialToken);
	const [handle, setHandle] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [deviceLabel, setDeviceLabel] = useState("this device");
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setStatus(null);
		try {
			const optionsRes = await postJson("/api/auth/register/options", {
				token,
				handle,
				displayName,
				deviceLabel,
			});
			if (!optionsRes.ok) {
				setStatus(errorCode(optionsRes.data));
				return;
			}
			const payload = optionsRes.data as {
				options: Parameters<typeof startRegistration>[0]["optionsJSON"];
			};
			const credential = await startRegistration({ optionsJSON: payload.options });
			const verifyRes = await postJson("/api/auth/register/verify", { credential });
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
		<form onSubmit={onSubmit}>
			<label>
				Invite
				<input
					className="mono"
					value={token}
					onChange={(e) => setToken(e.target.value)}
					autoComplete="off"
					required
				/>
			</label>
			<label>
				Handle
				<input
					className="mono"
					value={handle}
					onChange={(e) => setHandle(e.target.value)}
					autoComplete="username"
					required
					minLength={2}
					maxLength={32}
					pattern="[a-z0-9_]+"
				/>
			</label>
			<label>
				Display name
				<input
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
					autoComplete="name"
					required
					maxLength={64}
				/>
			</label>
			<label>
				Device
				<input
					value={deviceLabel}
					onChange={(e) => setDeviceLabel(e.target.value)}
					required
					maxLength={64}
				/>
			</label>
			<button type="submit" disabled={busy}>
				Create passkey
			</button>
			{status ? <p className="status mono">{status}</p> : null}
		</form>
	);
}
