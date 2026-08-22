"use client";

import { useEffect, useState } from "react";
import { errorCode, getJson } from "@/lib/client/http";
import { AdminNav } from "@/lib/ui/admin-nav";
import { formatBytes } from "@/lib/ui/bytes";
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
				<AdminNav />
				<Status value={status} />
				{usage ? (
					<>
						<p className="dir-meta seats-meta">
							R2 {formatBytes(usage.r2CommittedBytes)} of {formatBytes(usage.r2CeilingBytes)}
							{usage.r2PendingBytes > 0 ? ` · pending ${formatBytes(usage.r2PendingBytes)}` : ""}
						</p>
						<div className="meter">
							<span style={{ width: `${fill * 100}%` }} />
						</div>
						<p className="dir-meta">
							Class A ~{usage.classAEstimate} of {usage.classACeiling}. Class B is not counted.
						</p>
						<p className="dir-meta">
							{usage.seatsClaimed} of {usage.seatsTotal} seats taken
						</p>
						<ul className="dir-list">
							{usage.users.map((user) => (
								<li key={user.handle}>
									<div className="dir-head">
										<span className="dir-name">{user.handle}</span>
										<span className="dir-meta">
											{formatBytes(user.storageUsedBytes)} of {formatBytes(user.storageQuotaBytes)}
										</span>
									</div>
								</li>
							))}
						</ul>
					</>
				) : null}
			</Panel>
		</main>
	);
}
