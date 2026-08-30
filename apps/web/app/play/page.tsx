"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PlayBoard } from "@/lib/ui/play-board";
import { SessionLoading, useBrowserSession } from "@/lib/ui/session";

export default function PlayPage() {
	const { ready, me, hasLocal } = useBrowserSession();
	const router = useRouter();
	const bounce = ready && (Boolean(me) || hasLocal);

	useEffect(() => {
		if (bounce) {
			router.replace("/");
		}
	}, [bounce, router]);

	if (!ready || bounce) {
		return (
			<main>
				<SessionLoading title="Playground" />
			</main>
		);
	}

	return <PlayBoard />;
}
