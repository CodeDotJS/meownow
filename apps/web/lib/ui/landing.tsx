"use client";

import { DemoLog } from "./demo-log";

export function Landing() {
	return (
		<main className="landing">
			<h1 className="lede">
				<mark>Copy</mark> on this device.
				<br />
				Paste on the other.
			</h1>
			<p className="colophon mono">Ten seats. The server never reads it.</p>
			<nav className="stack">
				<a className="select" href="/login">
					Use passkey
				</a>
				<a href="/join">Join with invite</a>
				<a href="/recover">Recover with phrase</a>
			</nav>
			<DemoLog />
			<p className="hint">
				<a href="/enroll">First admin</a>
			</p>
		</main>
	);
}
