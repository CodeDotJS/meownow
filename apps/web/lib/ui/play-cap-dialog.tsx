"use client";

import { useEffect, useRef } from "react";
import { CatMark } from "./marks";

export function PlayCapDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const askRef = useRef<HTMLAnchorElement>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		askRef.current?.focus();
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose, open]);

	if (!open) {
		return null;
	}

	return (
		<div className="preview-layer">
			<button type="button" className="preview-dismiss" aria-label="Close" onClick={onClose} />
			<div
				className="preview-sheet play-cap-sheet"
				role="dialog"
				aria-modal="true"
				aria-labelledby="play-cap-title"
			>
				<CatMark className="empty-cat" size={72} decorative />
				<h2 id="play-cap-title">That's five</h2>
				<p className="lead">An invite unlocks the rest. Forget one to keep trying here.</p>
				<nav className="stack">
					<a ref={askRef} className="select" href="/ask">
						Ask for an invite
					</a>
					<a className="quiet" href="/join">
						I have a link
					</a>
					<button type="button" className="quiet" onClick={onClose}>
						Close
					</button>
				</nav>
			</div>
		</div>
	);
}
