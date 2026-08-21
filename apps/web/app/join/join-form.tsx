"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { type FormEvent, useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";
import { parseInviteToken } from "@/lib/ui/invite-url";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

export function JoinForm({ initialToken }: { initialToken: string }) {
	const [token, setToken] = useState(initialToken);
	const [handle, setHandle] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const invited = initialToken.length > 0;

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setStatus(null);
		try {
			const optionsRes = await postJson("/api/auth/register/options", {
				token: parseInviteToken(token),
				handle,
				displayName: displayName.trim() || handle,
				deviceLabel: "this device",
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
		<Panel>
			<h1>{invited ? "Join" : "You need an invite"}</h1>
			<p className="lead">
				{invited
					? "Pick a handle, then create a passkey on this device. Face ID or Windows Hello. No password."
					: "Someone already in has to send you a link. It looks like /join?t=… You can paste the code below if you have one."}
			</p>
			<form onSubmit={onSubmit}>
				{invited ? null : (
					<label>
						Invite code
						<input
							className="mono"
							value={token}
							onChange={(e) => setToken(e.target.value)}
							autoComplete="off"
							required
						/>
					</label>
				)}
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
						title="lowercase letters, numbers, underscore"
					/>
					<span className="field-hint">lowercase, no spaces</span>
				</label>
				<label>
					Name to show
					<input
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value)}
						autoComplete="name"
						maxLength={64}
						placeholder={handle || "same as handle"}
					/>
				</label>
				<button className="select" type="submit" disabled={busy}>
					{busy ? "Working…" : "Create a passkey"}
				</button>
				<Status value={status} />
			</form>
		</Panel>
	);
}
