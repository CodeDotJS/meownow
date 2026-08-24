"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import { AdminNav } from "@/lib/ui/admin-nav";
import { formatInviteLeft, type InviteRow, openInvites } from "@/lib/ui/invite-list";
import { inviteJoinUrl } from "@/lib/ui/invite-url";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

export default function InvitesPage() {
	const [invites, setInvites] = useState<InviteRow[]>([]);
	const [asks, setAsks] = useState<
		Array<{ id: string; email: string; note: string; createdAt: string }>
	>([]);
	const [note, setNote] = useState("");
	const [replyTo, setReplyTo] = useState<string | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		const [inviteRes, askRes] = await Promise.all([
			getJson("/api/invites"),
			getJson("/api/invite-asks"),
		]);
		if (!inviteRes.ok) {
			setStatus(errorCode(inviteRes.data));
			return;
		}
		if (!askRes.ok) {
			setStatus(errorCode(askRes.data));
			return;
		}
		setInvites((inviteRes.data as { invites: InviteRow[] }).invites);
		setAsks(
			(
				askRes.data as {
					asks: Array<{ id: string; email: string; note: string; createdAt: string }>;
				}
			).asks,
		);
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

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
				{asks.length > 0 ? (
					<>
						<p className="hint">
							{asks.length === 1
								? "1 person asked for a link."
								: `${asks.length} people asked for a link.`}
						</p>
						<ul className="dir-list">
							{asks.map((ask) => (
								<li key={ask.id}>
									<div className="dir-head">
										<span className="dir-name">{ask.email}</span>
										<span className="dir-actions">
											<button
												type="button"
												className="quiet"
												onClick={() => {
													setNote(ask.email.slice(0, 120));
													setReplyTo(ask.email);
												}}
											>
												Use
											</button>
											<button
												type="button"
												className="quiet"
												onClick={() => {
													void (async () => {
														const res = await fetch(`/api/invite-asks/${ask.id}`, {
															method: "DELETE",
															credentials: "include",
														});
														const data: unknown = await res.json();
														if (!res.ok) {
															setStatus(errorCode(data));
															return;
														}
														if (replyTo === ask.email) {
															setReplyTo(null);
														}
														await refresh();
													})();
												}}
											>
												Dismiss
											</button>
										</span>
									</div>
									{ask.note ? <p className="dir-meta">{ask.note}</p> : null}
								</li>
							))}
						</ul>
					</>
				) : null}
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
							{replyTo ? (
								<a
									className="select"
									href={`mailto:${replyTo}?subject=${encodeURIComponent("meownow invite")}&body=${encodeURIComponent(inviteJoinUrl(window.location.origin, token))}`}
								>
									Mail the link
								</a>
							) : null}
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
									<button type="button" className="quiet" onClick={() => void onRevoke(invite.id)}>
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
