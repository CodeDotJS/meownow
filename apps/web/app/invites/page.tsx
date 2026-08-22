"use client";

import { type FormEvent, useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import { inviteJoinUrl } from "@/lib/ui/invite-url";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

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
			<Panel>
				<h1>Invites</h1>
				<p className="lead">Send the link. One person, 72 hours, shown once.</p>
				<form onSubmit={onCreate}>
					<label>
						Note
						<input
							value={note}
							onChange={(e) => setNote(e.target.value)}
							maxLength={120}
							placeholder="who it is for"
						/>
					</label>
					<button className="select" type="submit">
						Make a link
					</button>
				</form>
				{token ? (
					<>
						<p className="lead">Send this. It will not be shown again.</p>
						<p className="phrase">{inviteJoinUrl(window.location.origin, token)}</p>
						<nav className="stack">
							<button
								className="select"
								type="button"
								onClick={() => {
									const url = inviteJoinUrl(window.location.origin, token);
									void navigator.clipboard.writeText(url).then(
										() => setStatus("Copied the invite link."),
										() => setStatus(url),
									);
								}}
							>
								Copy link
							</button>
						</nav>
					</>
				) : null}
				<Status value={status} />
				{invites.length === 0 ? <p className="hint">No invites yet.</p> : null}
				<ul>
					{invites.map((invite) => (
						<li key={invite.id}>
							<span>{invite.id.slice(0, 8)}</span>
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
			</Panel>
		</main>
	);
}
