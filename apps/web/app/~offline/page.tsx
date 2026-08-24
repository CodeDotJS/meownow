import type { Metadata } from "next";
import { Panel } from "@/lib/ui/panel";

export const metadata: Metadata = {
	title: "Offline",
	robots: { index: false, follow: false },
};

export default function OfflinePage() {
	return (
		<main>
			<Panel>
				<h1>Offline</h1>
				<p className="lead">Open Home. Notes already on this device still open from there.</p>
				<nav className="stack">
					<a className="select" href="/">
						Home
					</a>
				</nav>
			</Panel>
		</main>
	);
}
