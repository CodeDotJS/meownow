"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Panel } from "@/lib/ui/panel";
import { loadVault } from "@/lib/vault/idb";

export default function PairHubPage() {
	const router = useRouter();

	useEffect(() => {
		void loadVault().then((stored) => {
			router.replace(stored ? "/pair/scan" : "/pair/show");
		});
	}, [router]);

	return (
		<main>
			<Panel>
				<h1>Add a device</h1>
				<p className="lead">Checking this browser.</p>
			</Panel>
		</main>
	);
}
