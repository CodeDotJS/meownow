"use client";

import { type FormEvent, useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";

type Invite = {
	id: string;
	note: string | null;
	expiresAt: string;
	redeemedAt: string | null;
	revokedAt: string | null;
	createdAt: string;
};

export default function InvitesPage() {
	const [invites, setInvites] = useState<Invite[]>([]);
	const [note, setNote] = useState("");
	const [token, setToken] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	async function refresh() {
		const res = await getJson("/api/invites");
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		const data = res.data as { invites: Invite[] };
		setInvites(data.invites);
	}

	useEffect(() => {
		void (async () => {
			const res = await getJson("/api/invites");
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
			const data = res.data as { invites: Invite[] };
			setInvites(data.invites);
		})();
	}, []);

	async function onCreate(event: FormEvent) {
		event.preventDefault();
		setStatus(null);
		const res = await postJson("/api/invites", note ? { note } : {});
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		const created = res.data as { token: string };
		setToken(created.token);
		setNote("");
		await refresh();
	}

	async function onRevoke(id: string) {
		const res = await fetch(`/api/invites/${id}`, { method: "DELETE", credentials: "include" });
		const data: unknown = await res.json();
		if (!res.ok) {
			setStatus(errorCode(data));
			return;
		}
		setToken(null);
		await refresh();
	}

	return (
		<main>
			<h1>Invites</h1>
			<form onSubmit={onCreate}>
				<label>
					Note
					<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
				</label>
				<button type="submit">Issue invite</button>
			</form>
			{token ? (
				<p>
					Token (shown once): <span className="mono">{token}</span>
				</p>
			) : null}
			{status ? <p className="status mono">{status}</p> : null}
			<ul>
				{invites.map((invite) => (
					<li key={invite.id}>
						<span className="mono">{invite.id.slice(0, 8)}</span>
						{invite.note ? ` ${invite.note}` : ""}
						{invite.redeemedAt ? " redeemed" : invite.revokedAt ? " revoked" : " open"}
						{invite.redeemedAt || invite.revokedAt ? null : (
							<button type="button" onClick={() => void onRevoke(invite.id)}>
								Revoke
							</button>
						)}
					</li>
				))}
			</ul>
		</main>
	);
}
