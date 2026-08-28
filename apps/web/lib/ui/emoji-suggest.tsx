"use client";

import type { EmojiHit } from "./emoji-shortcodes";

export function EmojiSuggest({
	hits,
	active,
	left,
	top,
	below = false,
	onHover,
	onPick,
}: {
	hits: EmojiHit[];
	active: number;
	left: number;
	top: number;
	below?: boolean;
	onHover: (index: number) => void;
	onPick: (hit: EmojiHit) => void;
}) {
	if (hits.length === 0) {
		return null;
	}
	return (
		<div
			id="emoji-suggest"
			className={below ? "emoji-suggest is-below" : "emoji-suggest"}
			role="listbox"
			aria-label="Emoji"
			style={{ left, top }}
		>
			{hits.map((hit, index) => (
				<button
					key={`${hit.via}-${hit.alias}`}
					type="button"
					role="option"
					id={`emoji-opt-${hit.alias}`}
					className={index === active ? "emoji-suggest-item is-active" : "emoji-suggest-item"}
					aria-selected={index === active}
					onMouseDown={(event) => {
						event.preventDefault();
						onPick(hit);
					}}
					onMouseEnter={() => onHover(index)}
				>
					<span className="emoji-suggest-glyph" aria-hidden>
						{hit.emoji}
					</span>
					<span className="emoji-suggest-name">:{hit.alias}:</span>
				</button>
			))}
		</div>
	);
}
