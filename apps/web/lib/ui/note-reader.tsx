"use client";

import { useEffect, useRef } from "react";
import { CatMark } from "./marks";
import { NoteMarkdown } from "./note-markdown";
import { noteLineCount } from "./note-size";
import { PixelStamp } from "./pixel-avatar";

export type NoteReaderState = {
	id: string;
	text: string;
	createdAt: string;
};

export function NoteReader({
	note,
	copied,
	onClose,
	onCopy,
	onEdit,
}: {
	note: NoteReaderState | null;
	copied: boolean;
	onClose: () => void;
	onCopy: () => void;
	onEdit?: () => void;
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
				<div className="note-read-head">
					<p className="sheet-label" id="note-read-title">
						{lines === 1 ? "Note" : `${lines} lines`}
					</p>
					<button type="button" className="time-mark-hit" onClick={onCopy} aria-label="Copy">
						{copied ? (
							<CatMark className="time-mark is-copied" size={24} decorative />
						) : (
							<PixelStamp seed={note.createdAt} />
						)}
					</button>
				</div>
				<div className="note-read">
					<NoteMarkdown text={note.text} links />
				</div>
				<nav className="note-read-go">
					<button ref={copyRef} type="button" className="select" onClick={onCopy}>
						Copy
					</button>
					{onEdit ? (
						<button type="button" className="quiet" onClick={onEdit}>
							Edit
						</button>
					) : null}
					<button type="button" className="quiet" onClick={onClose}>
						Close
					</button>
				</nav>
			</div>
		</div>
	);
}
