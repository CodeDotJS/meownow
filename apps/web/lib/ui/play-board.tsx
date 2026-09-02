"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { idbPlayStore, PLAY_CAP, type PlayNote } from "@/lib/play/store";
import {
	addPlayImage,
	addPlayNote,
	forgetPlayNote,
	isPlayImageFile,
	PlayCapError,
	PlayNotImageError,
	PlayTooLargeError,
	playCountLabel,
	replacePlayNote,
} from "@/lib/play/write";
import { filesFromClipboard } from "./clipboard-files";
import { ComposerDraft } from "./composer-draft";
import { ComposerGlyph } from "./composer-glyph";
import { expandEmojiShortcodes } from "./emoji-shortcodes";
import { FilePreview, type FilePreviewState } from "./file-preview";
import { HeadProgressBar } from "./head-progress-bar";
import { HoverTip } from "./hover-tip";
import { CatMark, CopyMark, DeleteMark, EditMark, PreviewMark } from "./marks";
import { NoteMarkdown } from "./note-markdown";
import { PixelStamp, PixelThumb } from "./pixel-avatar";
import { PlayCapDialog } from "./play-cap-dialog";
import {
	readPlaySheetFocus,
	type SheetFocus,
	sheetFocusClass,
	writePlaySheetFocus,
} from "./sheet-focus";
import { SheetFocusToggle } from "./sheet-focus-toggle";
import { Status } from "./status";
import { formatClockTime, groupByDay } from "./time";

function playStatus(error: unknown): string {
	if (error instanceof PlayCapError) {
		return "play_cap";
	}
	if (error instanceof PlayTooLargeError) {
		return "play_too_large";
	}
	if (error instanceof PlayNotImageError) {
		return "play_not_image";
	}
	if (error instanceof Error && error.message === "empty") {
		return "play_empty";
	}
	return "send_failed";
}

export function PlayBoard() {
	const reduceMotion = useReducedMotion();
	const [notes, setNotes] = useState<PlayNote[]>([]);
	const [draft, setDraft] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [sending, setSending] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const [capOpen, setCapOpen] = useState(false);
	const [preview, setPreview] = useState<FilePreviewState | null>(null);
	const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
	const previewUrlsRef = useRef<Record<string, string>>({});
	const fileRef = useRef<HTMLInputElement>(null);
	const [sheetFocus, setSheetFocus] = useState<SheetFocus>("both");

	const refresh = useCallback(async () => {
		setNotes(await idbPlayStore.list());
	}, []);

	useEffect(() => {
		void refresh();
		setSheetFocus(readPlaySheetFocus());
	}, [refresh]);

	useEffect(() => {
		const tick = window.setInterval(() => setNow(Date.now()), 60_000);
		return () => window.clearInterval(tick);
	}, []);

	useEffect(() => {
		if (!copiedId) {
			return;
		}
		const timer = window.setTimeout(() => setCopiedId(null), 1600);
		return () => window.clearTimeout(timer);
	}, [copiedId]);

	useEffect(() => {
		if (!status) {
			return;
		}
		const timer = window.setTimeout(() => setStatus(null), 6000);
		return () => window.clearTimeout(timer);
	}, [status]);

	useEffect(() => {
		const keep = new Set(
			notes.filter((note) => note.kind === "image" && note.blob).map((note) => note.id),
		);
		const next: Record<string, string> = {};
		for (const [id, url] of Object.entries(previewUrlsRef.current)) {
			if (keep.has(id)) {
				next[id] = url;
			} else {
				URL.revokeObjectURL(url);
			}
		}
		for (const note of notes) {
			if (note.kind === "image" && note.blob && !next[note.id]) {
				next[note.id] = URL.createObjectURL(note.blob);
			}
		}
		previewUrlsRef.current = next;
		setPreviewUrls(next);
	}, [notes]);

	useEffect(() => {
		return () => {
			for (const url of Object.values(previewUrlsRef.current)) {
				URL.revokeObjectURL(url);
			}
		};
	}, []);

	const finishWrite = useCallback(async () => {
		const next = await idbPlayStore.list();
		setNotes(next);
		if (next.length >= PLAY_CAP) {
			setCapOpen(true);
		}
	}, []);

	const onImage = useCallback(
		async (file: File) => {
			setSending(true);
			setStatus(null);
			try {
				await addPlayImage(idbPlayStore, file);
				await finishWrite();
			} catch (error) {
				if (error instanceof PlayCapError) {
					setCapOpen(true);
				} else {
					setStatus(playStatus(error));
				}
			} finally {
				setSending(false);
			}
		},
		[finishWrite],
	);

	useEffect(() => {
		function onPaste(event: ClipboardEvent) {
			const image = filesFromClipboard(event.clipboardData).find(isPlayImageFile);
			if (!image) {
				return;
			}
			event.preventDefault();
			void onImage(image);
		}
		document.addEventListener("paste", onPaste);
		return () => document.removeEventListener("paste", onPaste);
	}, [onImage]);

	const onSheetFocus = useCallback((next: SheetFocus) => {
		setSheetFocus(next);
		writePlaySheetFocus(next);
	}, []);

	async function onSend() {
		const text = expandEmojiShortcodes(draft);
		setSending(true);
		setStatus(null);
		try {
			if (editingId) {
				await replacePlayNote(idbPlayStore, editingId, text);
				setEditingId(null);
			} else {
				await addPlayNote(idbPlayStore, text);
			}
			setDraft("");
			await finishWrite();
		} catch (error) {
			if (error instanceof PlayCapError) {
				setCapOpen(true);
			} else {
				setStatus(playStatus(error));
			}
		} finally {
			setSending(false);
		}
	}

	function startEdit(note: PlayNote) {
		if (note.kind === "image") {
			return;
		}
		if (editingId === note.id) {
			setEditingId(null);
			setDraft("");
			return;
		}
		setEditingId(note.id);
		setDraft(note.text);
	}

	function openPreview(note: PlayNote) {
		const url = previewUrls[note.id];
		if (!url || note.kind !== "image") {
			return;
		}
		setPreview({ url, filename: note.text, kind: "image" });
	}

	function downloadPreview() {
		if (!preview) {
			return;
		}
		const link = document.createElement("a");
		link.href = preview.url;
		link.download = preview.filename;
		link.click();
	}

	async function onForget(id: string) {
		if (editingId === id) {
			setEditingId(null);
			setDraft("");
		}
		const url = previewUrls[id];
		if (preview && url && preview.url === url) {
			setPreview(null);
		}
		await forgetPlayNote(idbPlayStore, id);
		await refresh();
		setCapOpen(false);
		setStatus("Forgotten.");
	}

	async function onCopy(text: string, id: string) {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedId(id);
			setStatus(null);
		} catch {
			setStatus("copy_failed");
		}
	}

	const draftLines = draft.split("\n").length;

	return (
		<main className="clipboard">
			<h1 className="file-hidden">Playground</h1>
			<p className="hint clip-hint">Five notes in this browser. An invite unlocks the rest.</p>
			<div className={`stage ${sheetFocusClass(sheetFocus)}`}>
				<div className="composer">
					<p className="sheet-label">{editingId ? "Edit paste" : "New paste"}</p>
					<ComposerDraft
						value={draft}
						label={editingId ? "Edit paste" : "New paste"}
						tabIndent
						onChange={setDraft}
						onSend={() => void onSend()}
					/>
					<div className="composer-foot">
						{draftLines > 8 ? <p className="field-hint">{draftLines} lines</p> : null}
						<div className="composer-bar">
							<HoverTip
								label={sending ? (editingId ? "Saving" : "Sending") : editingId ? "Save" : "Send"}
								place="above"
							>
								<button
									className="composer-icon"
									type="button"
									disabled={sending}
									aria-label={
										sending ? (editingId ? "Saving" : "Sending") : editingId ? "Save" : "Send"
									}
									onClick={() => void onSend()}
								>
									<ComposerGlyph name="send" />
								</button>
							</HoverTip>
							{editingId ? (
								<button
									type="button"
									className="quiet"
									onClick={() => {
										setEditingId(null);
										setDraft("");
									}}
								>
									Cancel
								</button>
							) : (
								<>
									<input
										ref={fileRef}
										className="file-hidden"
										type="file"
										accept="image/*"
										onChange={(event) => {
											const file = event.target.files?.[0];
											event.target.value = "";
											if (file) {
												void onImage(file);
											}
										}}
									/>
									<HoverTip label="Image" place="above">
										<button
											className="composer-icon"
											type="button"
											disabled={sending}
											aria-label="Image"
											onClick={() => fileRef.current?.click()}
										>
											<ComposerGlyph name="file" />
										</button>
									</HoverTip>
								</>
							)}
						</div>
						<Status value={status} />
					</div>
				</div>
				<div className="tray">
					<div className="log-head" aria-busy={sending}>
						<p className="sheet-label">On the clipboard</p>
						<div className="log-head-meta">
							<p className="clip-count">
								<span className="clip-count-num">{playCountLabel(notes.length)}</span>
								<span className="clip-count-word">{notes.length === 1 ? "note" : "notes"}</span>
							</p>
							<SheetFocusToggle focus={sheetFocus} onChange={onSheetFocus} />
						</div>
						<HeadProgressBar busy={sending} />
					</div>
					{status ? (
						<div className="tray-notice">
							<Status value={status} />
						</div>
					) : null}
					{notes.length === 0 ? (
						<div className="empty">
							<CatMark className="empty-cat" size={72} decorative />
							<p>
								Nothing here yet.
								<span className="empty-how">
									Five notes in this browser. An invite unlocks the rest.
								</span>
							</p>
						</div>
					) : (
						<div className="log log-sheet">
							{groupByDay(notes, now).map((group) => (
								<section className="log-day" key={group.key}>
									<h2 className="log-day-label">
										<span>{group.title}</span>
										{group.date ? <span className="log-day-date">{group.date}</span> : null}
									</h2>
									<ul className="log-day-items">
										<AnimatePresence initial={false}>
											{group.items.map((item) => {
												const isImage = item.kind === "image";
												return (
													<motion.li
														key={item.id}
														layout={!reduceMotion}
														initial={reduceMotion ? false : { opacity: 0, y: -10 }}
														animate={{ opacity: 1, y: 0 }}
														exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
														transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
														className={isImage ? "log-item has-file" : "log-item"}
													>
														<span className="gutter">
															<span className="gutter-time">{formatClockTime(item.createdAt)}</span>
															{copiedId === item.id ? (
																<CatMark className="time-mark is-copied" size={24} decorative />
															) : (
																<PixelStamp seed={item.createdAt} />
															)}
														</span>
														<span className="rail" aria-hidden />
														<div className="log-main">
															{isImage ? (
																<button
																	type="button"
																	className="body file-body"
																	onClick={() => openPreview(item)}
																>
																	<PixelThumb seed={item.id} label={item.text} />
																	<span className="file-copy">
																		<span className="file-name">
																			<span>{item.text}</span>
																		</span>
																		<span className="file-meta">Image</span>
																	</span>
																</button>
															) : (
																<div className="body">
																	<span className="note-md-row">
																		<NoteMarkdown text={item.text} links />
																	</span>
																</div>
															)}
															<span className="log-actions">
																{isImage ? (
																	<HoverTip label="Preview" place="above">
																		<button
																			type="button"
																			className="act act-icon"
																			aria-label="Preview"
																			onClick={() => openPreview(item)}
																		>
																			<PreviewMark size={15} decorative />
																		</button>
																	</HoverTip>
																) : (
																	<>
																		<HoverTip label="Copy" place="above">
																			<button
																				type="button"
																				className="act act-icon"
																				aria-label="Copy"
																				onClick={() => void onCopy(item.text, item.id)}
																			>
																				<CopyMark size={15} decorative />
																			</button>
																		</HoverTip>
																		<HoverTip
																			label={editingId === item.id ? "Cancel" : "Edit"}
																			place="above"
																		>
																			<button
																				type="button"
																				className={
																					editingId === item.id
																						? "act act-icon is-on"
																						: "act act-icon"
																				}
																				aria-label={editingId === item.id ? "Cancel" : "Edit"}
																				onClick={() => startEdit(item)}
																			>
																				<EditMark size={15} decorative />
																			</button>
																		</HoverTip>
																	</>
																)}
																<HoverTip label="Forget" place="above">
																	<button
																		type="button"
																		className="act act-icon"
																		aria-label="Forget"
																		onClick={() => void onForget(item.id)}
																	>
																		<DeleteMark size={15} decorative />
																	</button>
																</HoverTip>
															</span>
														</div>
													</motion.li>
												);
											})}
										</AnimatePresence>
									</ul>
								</section>
							))}
						</div>
					)}
				</div>
			</div>
			<PlayCapDialog open={capOpen} onClose={() => setCapOpen(false)} />
			<FilePreview
				preview={preview}
				onClose={() => setPreview(null)}
				onDownload={downloadPreview}
			/>
		</main>
	);
}
