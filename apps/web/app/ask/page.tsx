"use client";

import { type FormEvent, useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";
import { Panel } from "@/lib/ui/panel";
import { AlreadyHere, SessionLoading, useBrowserSession } from "@/lib/ui/session";
import { Status } from "@/lib/ui/status";

export default function AskPage() {
	const { ready, me } = useBrowserSession();
	const [email, setEmail] = useState("");
	const [note, setNote] = useState("");
	const [sent, setSent] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	if (!ready) {
		return (
			<main>
				<SessionLoading title="Ask for an invite" />
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

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setStatus(null);
		const res = await postJson("/api/invite-asks", {
			email,
			...(note.trim() ? { note } : {}),
		});
		setBusy(false);
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		setSent(true);
		setEmail("");
		setNote("");
	}

	return (
		<main>
			<Panel>
				<h1>Ask for an invite</h1>
				{sent ? (
					<>
						<p className="lead">Sent. Someone already in has to make a link and email it to you.</p>
						<nav className="stack">
							<a className="select" href="/">
								Back home
							</a>
						</nav>
					</>
				) : (
					<>
						<p className="lead">
							There is no public signup. Leave an email so someone already in can send you a join
							link.
						</p>
						<form onSubmit={(event) => void onSubmit(event)}>
							<label>
								Email
								<input
									type="email"
									autoComplete="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									placeholder="you@example.com"
								/>
							</label>
							<label>
								Anything else
								<textarea
									value={note}
									onChange={(e) => setNote(e.target.value)}
									rows={3}
									maxLength={200}
									placeholder="Optional. A name or why you want in."
								/>
							</label>
							<button className="select" type="submit" disabled={busy}>
								{busy ? "Working…" : "Ask"}
							</button>
						</form>
						<Status value={status} />
						<p className="hint">
							Already have a link? <a href="/join">Join</a>
						</p>
					</>
				)}
			</Panel>
		</main>
	);
}
