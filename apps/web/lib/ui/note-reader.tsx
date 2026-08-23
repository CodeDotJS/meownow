"use client";

import { useEffect, useRef } from "react";
import { noteLineCount } from "./note-size";

export type NoteReaderState = {
	id: string;
	text: string;
};

export function NoteReader({
	note,
	copied,
	onClose,
	onCopy,
}: {
	note: NoteReaderState | null;
	copied: boolean;
	onClose: () => void;
	onCopy: () => void;
}) {
	const copyRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!note) {
			return;
		}
		copyRef.current?.focus();
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [note, onClose]);

	if (!note) {
		return null;
	}

	const lines = noteLineCount(note.text);

	return (
		<div className="preview-layer">
			<button type="button" className="preview-dismiss" aria-label="Close" onClick={onClose} />
			<div
				className="preview-sheet"
				role="dialog"
				aria-modal="true"
				aria-labelledby="note-read-title"
			>
				<p className="sheet-label" id="note-read-title">
					{lines === 1 ? "Note" : `${lines} lines`}
				</p>
				<pre className="note-read">{note.text}</pre>
				<nav className="stack">
					<button ref={copyRef} type="button" className="select" onClick={onCopy}>
						{copied ? "Copied" : "Copy"}
					</button>
					<button type="button" className="quiet" onClick={onClose}>
						Close
					</button>
				</nav>
			</div>
		</div>
	);
}
