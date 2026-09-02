import { useEffect, useState } from "react";

export type HeadProgress = "idle" | "busy" | "done";

const DONE_MS = 400;

export function nextHeadProgress(current: HeadProgress, busy: boolean): HeadProgress {
	if (busy) {
		return "busy";
	}
	return current === "busy" ? "done" : current === "done" ? "done" : "idle";
}

export function useHeadProgress(busy: boolean): HeadProgress {
	const [phase, setPhase] = useState<HeadProgress>("idle");

	useEffect(() => {
		setPhase((current) => nextHeadProgress(current, busy));
	}, [busy]);

	useEffect(() => {
		if (phase !== "done") {
			return;
		}
		const timer = window.setTimeout(() => setPhase("idle"), DONE_MS);
		return () => window.clearTimeout(timer);
	}, [phase]);

	return phase;
}
