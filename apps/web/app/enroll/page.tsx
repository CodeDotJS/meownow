"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { type FormEvent, useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

export default function EnrollPage() {
	const [handle, setHandle] = useState("rishi");
	const [secret, setSecret] = useState("");
	const [deviceLabel, setDeviceLabel] = useState("this device");
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setStatus(null);
		try {
			const optionsRes = await postJson("/api/auth/admin-enroll/options", {
				handle,
				secret,
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
			const verifyRes = await postJson("/api/auth/admin-enroll/verify", { credential });
			if (!verifyRes.ok) {
				setStatus(errorCode(verifyRes.data));
				return;
			}
			window.location.href = "/setup";
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "passkey_failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main>
			<Panel>
				<h1>First admin</h1>
				<p className="lead">Creates seat 1 and a passkey. No password.</p>
				<form onSubmit={onSubmit}>
					<label>
						Handle
						<input
							className="mono"
							value={handle}
							onChange={(e) => setHandle(e.target.value)}
							required
							minLength={2}
							maxLength={32}
							pattern="[a-z0-9_]+"
						/>
					</label>
					<label>
						Enroll secret
						<input
							type="password"
							value={secret}
							onChange={(e) => setSecret(e.target.value)}
							required
							minLength={16}
							autoComplete="off"
						/>
					</label>
					<label>
						Device
						<input value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} required />
					</label>
					<button className="select" type="submit" disabled={busy}>
						Create passkey
					</button>
					<Status value={status} />
				</form>
			</Panel>
		</main>
	);
}
