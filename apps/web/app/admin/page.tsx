"use client";

import { useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";

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
			<h1>Admin</h1>
			<nav>
				<a href="/">Home</a>
				<a href="/invites">Invites</a>
				<a href="/requests">Requests</a>
				<a href="/admin/audit">Audit</a>
				<a href="/admin/usage">Usage</a>
			</nav>
			{seats ? (
				<p className="mono">
					Seats {seats.claimed} / {seats.total}
				</p>
			) : null}
			{status ? <p className="status mono">{status}</p> : null}
			<ul>
				{users.map((user) => (
					<li key={user.id}>
						<div>
							<span className="mono">{user.handle}</span> {user.displayName} {user.role}
							{user.canUpload ? " upload" : ""}
							<span className="mono">
								{" "}
								{user.storageUsedBytes} / {user.storageQuotaBytes}
							</span>
							{user.role === "member" ? (
								<button type="button" onClick={() => void remove(user.id)}>
									Remove
								</button>
							) : null}
							<ul>
								{user.devices.map((device) => (
									<li key={device.id}>
										<span className="mono">{device.label}</span>
										{device.revokedAt ? " revoked" : null}
										{device.revokedAt ? null : (
											<button type="button" onClick={() => void revoke(device.id)}>
												Revoke
											</button>
										)}
									</li>
								))}
							</ul>
						</div>
					</li>
				))}
			</ul>
		</main>
	);
}
