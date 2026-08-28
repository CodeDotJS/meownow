"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { textareaCaretOffset } from "./caret-rect";
import {
	closeShortcodeAtCaret,
	type EmojiHit,
	insertEmojiAt,
	shortcodeQueryAt,
	suggestEmoji,
} from "./emoji-shortcodes";
import { EmojiSuggest } from "./emoji-suggest";

function fitComposerHeight(area: HTMLTextAreaElement): void {
	if (window.matchMedia("(min-width: 960px)").matches) {
		area.style.height = "";
		return;
	}
	area.style.height = "auto";
	area.style.height = `${area.scrollHeight}px`;
}

export function ComposerDraft({
	value,
	label,
	onChange,
	onSend,
}: {
	value: string;
	label: string;
	onChange: (next: string) => void;
	onSend: () => void;
}) {
	const areaRef = useRef<HTMLTextAreaElement>(null);
	const pendingCaret = useRef<number | null>(null);
	const [query, setQuery] = useState<{ start: number; query: string; caret: number } | null>(null);
	const [active, setActive] = useState(0);
	const [box, setBox] = useState<{ left: number; top: number; below: boolean } | null>(null);

	const hits = query ? suggestEmoji(query.query) : [];
	const open = hits.length > 0;
	const queryName = query?.query ?? "";

	useLayoutEffect(() => {
		const caret = pendingCaret.current;
		const area = areaRef.current;
		if (caret === null || !area || area.value !== value) {
			return;
		}
		pendingCaret.current = null;
		area.setSelectionRange(caret, caret);
	}, [value]);

	useLayoutEffect(() => {
		const area = areaRef.current;
		if (!area || area.value !== value) {
			return;
		}
		fitComposerHeight(area);
	}, [value]);

	useEffect(() => {
		const area = areaRef.current;
		if (!area) {
			return;
		}
		const onResize = () => fitComposerHeight(area);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	useLayoutEffect(() => {
		const area = areaRef.current;
		if (!open || !query || !area || area.value !== value) {
			setBox(null);
			return;
		}
		const caret = textareaCaretOffset(area, query.caret);
		const rect = area.getBoundingClientRect();
		const left = Math.min(Math.max(8, rect.left + caret.left), window.innerWidth - 16);
		const caretTop = rect.top + caret.top;
		const below = caretTop < 132;
		setBox({ left, top: below ? caretTop + caret.height : caretTop, below });
	}, [open, query, value]);

	useEffect(() => {
		if (queryName.length >= 0) {
			setActive(0);
		}
	}, [queryName]);

	function apply(next: string, caret: number): void {
		pendingCaret.current = caret;
		onChange(next);
		const token = shortcodeQueryAt(next, caret);
		setQuery(token ? { ...token, caret } : null);
	}

	function pick(hit: EmojiHit): void {
		if (!query) {
			return;
		}
		const inserted = insertEmojiAt(value, query.start, query.caret, hit.emoji);
		apply(inserted.text, inserted.caret);
		setQuery(null);
	}

	return (
		<div className="composer-field">
			<textarea
				ref={areaRef}
				aria-label={label}
				value={value}
				placeholder="Type or paste"
				enterKeyHint="enter"
				autoComplete="off"
				autoCorrect="on"
				rows={3}
				onChange={(event) => {
					const next = event.target.value;
					const caret = event.target.selectionStart;
					const closed = closeShortcodeAtCaret(next, caret);
					if (closed) {
						apply(closed.text, closed.caret);
						return;
					}
					apply(next, caret);
				}}
				onKeyDown={(event) => {
					if (open) {
						if (event.key === "ArrowDown") {
							event.preventDefault();
							setActive((index) => Math.min(hits.length - 1, index + 1));
							return;
						}
						if (event.key === "ArrowUp") {
							event.preventDefault();
							setActive((index) => Math.max(0, index - 1));
							return;
						}
						if (event.key === "Escape") {
							event.preventDefault();
							setQuery(null);
							return;
						}
						if (
							(event.key === "Enter" || event.key === "Tab") &&
							!event.metaKey &&
							!event.ctrlKey &&
							!event.nativeEvent.isComposing
						) {
							const hit = hits[active] ?? hits[0];
							if (hit) {
								event.preventDefault();
								pick(hit);
							}
							return;
						}
					}
					if (
						event.key === "Enter" &&
						(event.metaKey || event.ctrlKey) &&
						!event.nativeEvent.isComposing
					) {
						event.preventDefault();
						onSend();
					}
				}}
				onBlur={() => {
					window.setTimeout(() => setQuery(null), 0);
				}}
			/>
			{open && box ? (
				<EmojiSuggest
					hits={hits}
					active={Math.min(active, hits.length - 1)}
					left={box.left}
					top={box.top}
					below={box.below}
					onHover={setActive}
					onPick={pick}
				/>
			) : null}
		</div>
	);
}
