"use client";

import { useEffect } from "react";
import { HoverTip } from "./hover-tip";
import { PaneMark } from "./marks";
import {
	isSheetFocusHotkey,
	nextSheetFocus,
	type SheetFocus,
	sheetFocusHint,
	sheetFocusHotkeyLabel,
	sheetFocusLabel,
} from "./sheet-focus";

export function SheetFocusToggle({
	focus,
	onChange,
}: {
	focus: SheetFocus;
	onChange: (next: SheetFocus) => void;
}) {
	const next = nextSheetFocus(focus);
	const current = sheetFocusLabel(focus);
	const hint = sheetFocusHint(focus);
	const hotkey = sheetFocusHotkeyLabel();

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (!isSheetFocusHotkey(event)) {
				return;
			}
			event.preventDefault();
			onChange(nextSheetFocus(focus));
		}
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [focus, onChange]);

	return (
		<HoverTip label={`${hint} · ${hotkey}`} place="below">
			<button
				className={focus === "both" ? "composer-icon" : "composer-icon is-on"}
				type="button"
				aria-label={`${current}. Next: ${hint}. ${hotkey}`}
				aria-keyshortcuts="Control+\\ Meta+\\"
				onClick={() => onChange(next)}
			>
				<PaneMark size={15} decorative />
			</button>
		</HoverTip>
	);
}
