export const SHEET_FOCUS = ["both", "write", "tray"] as const;
export type SheetFocus = (typeof SHEET_FOCUS)[number];

export const PLAY_SHEET_FOCUS_KEY = "meownow-play-focus";

const LABELS: Record<SheetFocus, string> = {
	both: "Both panes",
	write: "Write only",
	tray: "Tray only",
};

export function asSheetFocus(value: unknown): SheetFocus {
	return value === "write" || value === "tray" ? value : "both";
}

export function nextSheetFocus(current: SheetFocus): SheetFocus {
	const index = SHEET_FOCUS.indexOf(current);
	return SHEET_FOCUS[(index + 1) % SHEET_FOCUS.length] ?? "both";
}

export function sheetFocusLabel(focus: SheetFocus): string {
	return LABELS[focus];
}

export function sheetFocusHint(focus: SheetFocus): string {
	return LABELS[nextSheetFocus(focus)];
}

export function sheetFocusClass(focus: SheetFocus): string {
	return `is-focus-${focus}`;
}

type HotkeyEvent = Pick<
	KeyboardEvent,
	"altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export function isSheetFocusHotkey(event: HotkeyEvent): boolean {
	if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
		return false;
	}
	return event.code === "Backslash" || event.key === "\\";
}

export function sheetFocusHotkeyLabel(
	platform = typeof navigator === "undefined" ? "" : navigator.platform,
): string {
	return /Mac|iPhone|iPad/.test(platform) ? "⌘\\" : "Ctrl \\";
}

export function readPlaySheetFocus(): SheetFocus {
	try {
		return asSheetFocus(sessionStorage.getItem(PLAY_SHEET_FOCUS_KEY));
	} catch {
		return "both";
	}
}

export function writePlaySheetFocus(focus: SheetFocus): void {
	try {
		sessionStorage.setItem(PLAY_SHEET_FOCUS_KEY, focus);
	} catch {
		// Private mode can block sessionStorage.
	}
}
