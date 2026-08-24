"use client";

import { QUOTA_GRANT_MAX_MB, QUOTA_GRANT_MIN_MB, quotaBytesToMb } from "@meownow/protocol";
import { useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import { AdminNav } from "@/lib/ui/admin-nav";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

type Row = {
	id: string;
	handle: string;
	reason: string;
	status: string;
	requestedBytes: number;
	grantedBytes: number | null;
	createdAt: string;
};

export default function RequestsPage() {
	const [rows, setRows] = useState<Row[]>([]);
	const [status, setStatus] = useState<string | null>(null);

	async function refresh() {
		const res = await getJson("/api/uploads/requests");
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		setRows((res.data as { requests: Row[] }).requests);
	}

	useEffect(() => {
		void (async () => {
			const res = await getJson("/api/uploads/requests");
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
			setRows((res.data as { requests: Row[] }).requests);
		})();
	}, []);

	const pending = rows.filter((row) => row.status === "pending");
	const settled = rows.length - pending.length;

	return (
		<main>
			<Panel>
				<h1>Requests</h1>
				<p className="lead">Grant 25 to 100 MB of file space. Text and links do not need this.</p>
				<AdminNav />
				<Status value={status} />
				{pending.length === 0 ? <p className="hint">No pending requests.</p> : null}
				{pending.length > 0 ? (
					<ul className="dir-list">
						{pending.map((row) => (
							<PendingRequest
								key={row.id}
								row={row}
								onStatus={setStatus}
								onDone={() => void refresh()}
							/>
						))}
					</ul>
				) : null}
				{settled > 0 ? (
					<p className="hint">
						{settled === 1 ? "1 settled request." : `${settled} settled requests.`}
					</p>
				) : null}
			</Panel>
		</main>
	);
}

function PendingRequest({
	row,
	onStatus,
	onDone,
}: {
	row: Row;
	onStatus: (value: string | null) => void;
	onDone: () => void;
}) {
	const [mb, setMb] = useState(String(quotaBytesToMb(row.requestedBytes)));

	async function decide(next: "approved" | "denied") {
		onStatus(null);
		const res = await postJson(`/api/uploads/requests/${row.id}/decide`, {
			status: next,
			grantedMb: next === "approved" ? Number(mb) : undefined,
		});
		if (!res.ok) {
			onStatus(errorCode(res.data));
			return;
		}
		onDone();
	}

	return (
		<li>
			<div className="dir-head">
				<span className="dir-name">{row.handle}</span>
				<span className="dir-actions">
					<button type="button" className="select" onClick={() => void decide("approved")}>
						Approve
					</button>
					<button type="button" className="quiet" onClick={() => void decide("denied")}>
						Deny
					</button>
				</span>
			</div>
			<label>
				Grant, in MB
				<input
					type="number"
					inputMode="numeric"
					min={QUOTA_GRANT_MIN_MB}
					max={QUOTA_GRANT_MAX_MB}
					step={1}
					value={mb}
					onChange={(e) => setMb(e.target.value)}
					required
				/>
			</label>
			<p className="dir-meta">
				Asked for {quotaBytesToMb(row.requestedBytes)} MB
				{row.reason ? ` · ${row.reason}` : ""}
			</p>
		</li>
	);
}
