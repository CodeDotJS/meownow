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
				<p className="lead">Items already on this device still open from the local cache.</p>
			</Panel>
		</main>
	);
}
