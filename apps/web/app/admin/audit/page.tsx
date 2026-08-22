"use client";

import { useEffect, useState } from "react";
import { errorCode, getJson } from "@/lib/client/http";
import { AdminNav } from "@/lib/ui/admin-nav";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";
import { formatGutterTime } from "@/lib/ui/time";

type Entry = {
	id: number;
	actorId: string | null;
	action: string;
	subjectType: string | null;
	subjectId: string | null;
	createdAt: string;
};

const ACTIONS: Record<string, string> = {
	"invite.issued": "Invite issued",
	"invite.revoked": "Invite revoked",
	"invite.redeemed": "Invite redeemed",
	"device.revoked": "Device revoked",
	"user.removed": "Person removed",
	"auth.admin_enroll": "First admin enrolled",
	"auth.login": "Sign in",
	"upload.requested": "Upload requested",
	"upload.approved": "Upload approved",
	"upload.denied": "Upload denied",
};

export default function AuditPage() {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [now, setNow] = useState(Date.now());
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		setNow(Date.now());
		void (async () => {
			const res = await getJson("/api/admin/audit");
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
			setEntries((res.data as { entries: Entry[] }).entries);
		})();
	}, []);

	return (
		<main>
			<Panel>
				<h1>Audit</h1>
				<p className="lead">Privileged actions. Append-only.</p>
				<AdminNav />
				<Status value={status} />
				{entries.length === 0 ? <p className="hint">Nothing logged yet.</p> : null}
				{entries.length > 0 ? (
					<ul className="dir-list">
						{entries.map((entry) => (
							<li key={entry.id}>
								<div className="dir-head">
									<span className="dir-name">{ACTIONS[entry.action] ?? entry.action}</span>
									<span className="dir-meta">{formatGutterTime(entry.createdAt, now)}</span>
								</div>
							</li>
						))}
					</ul>
				) : null}
			</Panel>
		</main>
	);
}
