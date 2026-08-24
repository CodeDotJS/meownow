"use client";

import { QUOTA_GRANT_MAX_MB, QUOTA_GRANT_MIN_MB } from "@meownow/protocol";
import { type FormEvent, useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

export default function AccessPage() {
	const [mb, setMb] = useState(String(QUOTA_GRANT_MIN_MB));
	const [reason, setReason] = useState("");
	const [status, setStatus] = useState<string | null>(null);

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setStatus(null);
		const res = await postJson("/api/uploads/request", {
			requestedMb: Number(mb),
			reason,
		});
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		setReason("");
		setMb(String(QUOTA_GRANT_MIN_MB));
		setStatus("Request sent.");
	}

	return (
		<main>
			<Panel>
				<h1>Upload access</h1>
				<p className="lead">Ask for 25 to 100 MB of file space. Text and links do not need this.</p>
				<form onSubmit={(event) => void onSubmit(event)}>
					<label>
						How much, in MB
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
					<label>
						Reason
						<input
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							maxLength={240}
							required
						/>
					</label>
					<button className="select" type="submit">
						Request
					</button>
				</form>
				<Status value={status} />
			</Panel>
		</main>
	);
}
