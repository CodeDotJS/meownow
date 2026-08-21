import { Panel } from "@/lib/ui/panel";

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
