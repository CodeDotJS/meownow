"use client";

import { useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import { AdminNav } from "@/lib/ui/admin-nav";
import { formatBytes } from "@/lib/ui/bytes";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";

type Device = {
	id: string;
	label: string;
	revokedAt: string | null;
	lastSeenAt: string | null;
	createdAt: string;
};

type User = {
	id: string;
	handle: string;
	displayName: string;
	role: "admin" | "member";
	canUpload: boolean;
	storageQuotaBytes: number;
	storageUsedBytes: number;
	devices: Device[];
};

export default function AdminPage() {
	const [users, setUsers] = useState<User[]>([]);
	const [seats, setSeats] = useState<{ claimed: number; total: number } | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	async function refresh() {
		const res = await getJson("/api/admin/users");
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		const data = res.data as { users: User[]; seatsClaimed: number; seatsTotal: number };
		setUsers(data.users);
		setSeats({ claimed: data.seatsClaimed, total: data.seatsTotal });
	}

	useEffect(() => {
		void (async () => {
			const res = await getJson("/api/admin/users");
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
			const data = res.data as { users: User[]; seatsClaimed: number; seatsTotal: number };
			setUsers(data.users);
			setSeats({ claimed: data.seatsClaimed, total: data.seatsTotal });
		})();
	}, []);

	async function revoke(id: string) {
		setStatus(null);
		const res = await postJson(`/api/admin/devices/${id}/revoke`, {});
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		await refresh();
	}

	async function remove(id: string) {
		setStatus(null);
		const res = await postJson(`/api/admin/users/${id}/remove`, {});
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		await refresh();
	}

	return (
		<main>
			<Panel>
				<h1>People</h1>
				<p className="lead">Who is here, and which browsers they use.</p>
				<AdminNav />
				{seats ? (
					<p className="dir-meta seats-meta">
						{seats.claimed} {seats.claimed === 1 ? "person" : "people"}
					</p>
				) : null}
				<Status value={status} />
				<ul className="dir-list">
					{users.map((user) => {
						const live = user.devices.filter((device) => !device.revokedAt);
						const revoked = user.devices.length - live.length;
						return (
							<li key={user.id}>
								<div className="dir-head">
									<div>
										<p className="dir-name">{user.handle}</p>
										<p className="dir-meta">
											{user.displayName}
											{user.role === "admin" ? " · admin" : ""}
											{user.canUpload ? " · files" : ""}
											{" · "}
											{formatBytes(user.storageUsedBytes)} of {formatBytes(user.storageQuotaBytes)}
										</p>
									</div>
									{user.role === "member" ? (
										<button type="button" onClick={() => void remove(user.id)}>
											Remove
										</button>
									) : null}
								</div>
								{live.length > 0 ? (
									<ul className="dir-devices">
										{live.map((device) => (
											<li key={device.id}>
												<span>{device.label}</span>
												<button type="button" onClick={() => void revoke(device.id)}>
													Revoke
												</button>
											</li>
										))}
									</ul>
								) : (
									<p className="dir-meta">No live devices.</p>
								)}
								{revoked > 0 ? (
									<p className="dir-meta">
										{revoked === 1 ? "1 revoked device." : `${revoked} revoked devices.`}
									</p>
								) : null}
							</li>
						);
					})}
				</ul>
			</Panel>
		</main>
	);
}
