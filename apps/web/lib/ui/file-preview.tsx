"use client";

import { useEffect } from "react";

export type FilePreviewState = {
	url: string;
	filename: string;
	kind: "image" | "file";
};

export function FilePreview({
	preview,
	onClose,
	onDownload,
}: {
	preview: FilePreviewState | null;
	onClose: () => void;
	onDownload: () => void;
}) {
	useEffect(() => {
		if (!preview) {
			return;
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose, preview]);

	if (!preview) {
		return null;
	}

	return (
		<div className="preview-layer">
			<button type="button" className="preview-dismiss" aria-label="Close" onClick={onClose} />
			<div className="preview-sheet" role="dialog" aria-modal="true" aria-label={preview.filename}>
				<p className="sheet-label">{preview.filename}</p>
				{preview.kind === "image" ? (
					<img className="preview-img" src={preview.url} alt={preview.filename} />
				) : (
					<p className="lead">This file is ready. Download it to open it.</p>
				)}
				<nav className="stack">
					<button type="button" className="select" onClick={onDownload}>
						Download
					</button>
					<button type="button" className="quiet" onClick={onClose}>
						Close
					</button>
				</nav>
			</div>
		</div>
	);
}
