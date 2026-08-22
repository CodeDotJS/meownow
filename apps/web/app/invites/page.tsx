"use client";

import { type FormEvent, useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import { AdminNav } from "@/lib/ui/admin-nav";
import { formatInviteLeft, type InviteRow, openInvites } from "@/lib/ui/invite-list";
import { inviteJoinUrl } from "@/lib/ui/invite-url";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

export default function InvitesPage() {
	const [invites, setInvites] = useState<InviteRow[]>([]);
	const [note, setNote] = useState("");
	const [token, setToken] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	async function refresh() {
		const res = await getJson("/api/invites");
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		const data = res.data as { invites: InviteRow[] };
		setInvites(data.invites);
	}

	useEffect(() => {
		void (async () => {
			const res = await getJson("/api/invites");
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
			const data = res.data as { invites: InviteRow[] };
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

	const open = openInvites(invites);
	const closed = invites.length - open.length;

	return (
		<main>
			<Panel>
				<h1>Invites</h1>
				<p className="lead">Send the link. One person, 72 hours, shown once.</p>
				<AdminNav />
				<form onSubmit={onCreate}>
					<label>
						Who it is for
						<input
							value={note}
							onChange={(e) => setNote(e.target.value)}
							maxLength={120}
							placeholder="optional note"
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
				{open.length === 0 ? <p className="hint">No open invites.</p> : null}
				{open.length > 0 ? (
					<ul className="dir-list">
						{open.map((invite) => (
							<li key={invite.id}>
								<div className="dir-head">
									<span className="dir-name">{invite.note || "Invite"}</span>
									<button type="button" onClick={() => void onRevoke(invite.id)}>
										Revoke
									</button>
								</div>
								<p className="dir-meta">{formatInviteLeft(invite.expiresAt)}</p>
							</li>
						))}
					</ul>
				) : null}
				{closed > 0 ? (
					<p className="hint">
						{closed === 1 ? "1 closed invite." : `${closed} closed invites.`} They cannot be used.
					</p>
				) : null}
			</Panel>
		</main>
	);
}
