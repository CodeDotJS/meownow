"use client";

import { useEffect, useState } from "react";
import { errorCode, getJson } from "@/lib/client/http";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

type Entry = {
	id: number;
	actorId: string | null;
	action: string;
	subjectType: string | null;
	subjectId: string | null;
	createdAt: string;
};

export default function AuditPage() {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
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
				<nav>
					<a href="/admin">Admin</a>
				</nav>
				<Status value={status} />
				<ul>
					{entries.map((entry) => (
						<li key={entry.id}>
							<span>{entry.createdAt}</span> {entry.action}
							{entry.subjectType ? (
								<span>
									{" "}
									{entry.subjectType}/{entry.subjectId?.slice(0, 8)}
								</span>
							) : null}
						</li>
					))}
				</ul>
			</Panel>
		</main>
	);
}
