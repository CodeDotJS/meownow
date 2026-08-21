"use client";

import { type FormEvent, useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";

export default function AccessPage() {
	const [reason, setReason] = useState("");
	const [status, setStatus] = useState<string | null>(null);

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setStatus(null);
		const res = await postJson("/api/uploads/request", { reason });
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		setReason("");
		setStatus("Request sent.");
	}

	return (
		<main>
			<h1>Upload access</h1>
			<p>Ask an admin for R2 quota. Text and links do not need this.</p>
			<form onSubmit={(event) => void onSubmit(event)}>
				<label>
					Reason
					<input
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						maxLength={240}
						required
					/>
				</label>
				<button type="submit">Request</button>
			</form>
			{status ? <p className="status mono">{status}</p> : null}
		</main>
	);
}
