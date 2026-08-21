"use client";

import { useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";

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
			<h1>Upload requests</h1>
			<label>
				Grant bytes
				<input value={grant} onChange={(e) => setGrant(e.target.value)} className="mono" />
			</label>
			{status ? <p className="status mono">{status}</p> : null}
			<ul>
				{rows.map((row) => (
					<li key={row.id}>
						<span className="mono">{row.handle}</span> {row.reason} {row.status}
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
		</main>
	);
}
