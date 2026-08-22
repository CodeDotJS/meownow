"use client";

import { useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
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

export default function RequestsPage() {
	const [rows, setRows] = useState<Row[]>([]);
	const [status, setStatus] = useState<string | null>(null);
	const [grant, setGrant] = useState("524288000");

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

	return (
		<main>
			<Panel>
				<h1>Upload requests</h1>
				<p className="lead">Grant file upload space. Text and links do not need this.</p>
				<label>
					Grant bytes
					<input value={grant} onChange={(e) => setGrant(e.target.value)} />
				</label>
				<Status value={status} />
				{rows.length === 0 ? <p className="hint">No pending requests.</p> : null}
				<ul>
					{rows.map((row) => (
						<li key={row.id}>
							<span>{row.handle}</span> {row.reason} {row.status}
							{row.status === "pending" ? (
								<>
									<button type="button" onClick={() => void decide(row.id, "approved")}>
										Approve
									</button>
									<button type="button" onClick={() => void decide(row.id, "denied")}>
										Deny
									</button>
								</>
							) : null}
						</li>
					))}
				</ul>
			</Panel>
		</main>
	);
}
