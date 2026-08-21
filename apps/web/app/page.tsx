"use client";

import { useEffect, useState } from "react";
import { getJson, postJson } from "@/lib/client/http";

type Me = {
	handle: string;
	displayName: string;
	role: "admin" | "member";
	canUpload: boolean;
};

export default function Page() {
	const [me, setMe] = useState<Me | null>(null);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		void getJson("/api/auth/me").then((res) => {
			if (res.ok) {
				setMe(res.data as Me);
			}
			setLoaded(true);
		});
	}, []);

	async function onLogout() {
		await postJson("/api/auth/logout", {});
		window.location.reload();
	}

	return (
		<main>
			<h1 className="mono">meownow</h1>
			{!loaded ? <p>…</p> : null}
			{loaded && me ? (
				<>
					<p>
						Signed in as <span className="mono">{me.handle}</span>
					</p>
					<nav>
						{me.role === "admin" ? <a href="/invites">Invites</a> : null}
						<button type="button" onClick={() => void onLogout()}>
							Logout
						</button>
					</nav>
				</>
			) : null}
			{loaded && !me ? (
				<nav>
					<a href="/login">Login</a>
					<a href="/join">Join</a>
					<a href="/enroll">Admin enroll</a>
				</nav>
			) : null}
		</main>
	);
}
