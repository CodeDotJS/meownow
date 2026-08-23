"use client";

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
	grantedBytes: number | null;
	createdAt: string;
};

const GRANTS = [
	{ bytes: 524_288_000, label: "500 MB" },
	{ bytes: 1_073_741_824, label: "1 GB" },
] as const;

export default function RequestsPage() {
	const [rows, setRows] = useState<Row[]>([]);
	const [status, setStatus] = useState<string | null>(null);
	const [grant, setGrant] = useState(String(GRANTS[0].bytes));

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

	async function decide(id: string, next: "approved" | "denied") {
		setStatus(null);
		const res = await postJson(`/api/uploads/requests/${id}/decide`, {
			status: next,
			grantedBytes: next === "approved" ? Number(grant) : undefined,
		});
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		await refresh();
	}

	const pending = rows.filter((row) => row.status === "pending");
	const settled = rows.length - pending.length;

	return (
		<main>
			<Panel>
				<h1>Requests</h1>
				<p className="lead">Grant file space. Text and links do not need this.</p>
				<AdminNav />
				<label>
					If you approve, grant
					<select value={grant} onChange={(e) => setGrant(e.target.value)}>
						{GRANTS.map((option) => (
							<option key={option.bytes} value={option.bytes}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				<Status value={status} />
				{pending.length === 0 ? <p className="hint">No pending requests.</p> : null}
				{pending.length > 0 ? (
					<ul className="dir-list">
						{pending.map((row) => (
							<li key={row.id}>
								<div className="dir-head">
									<span className="dir-name">{row.handle}</span>
									<span className="dir-actions">
										<button
											type="button"
											className="select"
											onClick={() => void decide(row.id, "approved")}
										>
											Approve
										</button>
										<button
											type="button"
											className="quiet"
											onClick={() => void decide(row.id, "denied")}
										>
											Deny
										</button>
									</span>
								</div>
								{row.reason ? <p className="dir-meta">{row.reason}</p> : null}
							</li>
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
