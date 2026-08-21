"use client";

import { useEffect, useState } from "react";
import { errorCode, getJson } from "@/lib/client/http";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

type Usage = {
	r2CommittedBytes: number;
	r2PendingBytes: number;
	r2CeilingBytes: number;
	classAEstimate: number;
	classACeiling: number;
	classBCounted: false;
	classBCeiling: number;
	seatsClaimed: number;
	seatsTotal: number;
	users: Array<{
		handle: string;
		storageUsedBytes: number;
		storageQuotaBytes: number;
	}>;
};

function formatBytes(n: number): string {
	if (n < 1024) {
		return `${n} B`;
	}
	if (n < 1024 * 1024) {
		return `${(n / 1024).toFixed(1)} KB`;
	}
	if (n < 1024 * 1024 * 1024) {
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	}
	return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function UsagePage() {
	const [usage, setUsage] = useState<Usage | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		void (async () => {
			const res = await getJson("/api/admin/usage");
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
			setUsage(res.data as Usage);
		})();
	}, []);

	const fill = usage ? Math.min(1, usage.r2CommittedBytes / usage.r2CeilingBytes) : 0;

	return (
		<main>
			<Panel>
				<h1>Usage</h1>
				<p className="lead">Free-tier ceiling. Stay under it.</p>
				<nav>
					<a href="/admin">Admin</a>
				</nav>
				<Status value={status} />
				{usage ? (
					<>
						<p className="mono">
							R2 {formatBytes(usage.r2CommittedBytes)} / {formatBytes(usage.r2CeilingBytes)}
							{usage.r2PendingBytes > 0 ? ` pending ${formatBytes(usage.r2PendingBytes)}` : ""}
						</p>
						<div className="meter">
							<span style={{ width: `${fill * 100}%` }} />
						</div>
						<p className="mono">
							Class A ~{usage.classAEstimate} / {usage.classACeiling}
						</p>
						<p className="mono">Class B not counted / {usage.classBCeiling}</p>
						<p className="mono">
							Seats {usage.seatsClaimed} / {usage.seatsTotal}
						</p>
						<ul>
							{usage.users.map((user) => (
								<li key={user.handle}>
									<span className="mono">{user.handle}</span>
									<span className="mono">
										{formatBytes(user.storageUsedBytes)} / {formatBytes(user.storageQuotaBytes)}
									</span>
								</li>
							))}
						</ul>
					</>
				) : null}
			</Panel>
		</main>
	);
}
