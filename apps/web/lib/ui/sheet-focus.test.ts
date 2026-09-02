import { expect, test } from "vitest";
import {
	asSheetFocus,
	isSheetFocusHotkey,
	nextSheetFocus,
	readPlaySheetFocus,
	sheetFocusClass,
	sheetFocusHint,
	sheetFocusHotkeyLabel,
	sheetFocusLabel,
	writePlaySheetFocus,
} from "./sheet-focus";

test("unknown focus falls back to both panes", () => {
	expect(asSheetFocus(undefined)).toBe("both");
	expect(asSheetFocus("wide")).toBe("both");
	expect(asSheetFocus("write")).toBe("write");
	expect(asSheetFocus("tray")).toBe("tray");
});

test("cycles both, write, tray, then both again", () => {
	expect(nextSheetFocus("both")).toBe("write");
	expect(nextSheetFocus("write")).toBe("tray");
	expect(nextSheetFocus("tray")).toBe("both");
});

test("labels say what is showing and what the next tap does", () => {
	expect(sheetFocusLabel("both")).toBe("Both panes");
	expect(sheetFocusHint("both")).toBe("Write only");
	expect(sheetFocusHint("write")).toBe("Tray only");
	expect(sheetFocusHint("tray")).toBe("Both panes");
	expect(sheetFocusClass("write")).toBe("is-focus-write");
});

test("hotkey is command or control with backslash", () => {
	const stroke = {
		altKey: false,
		shiftKey: false,
		code: "Backslash",
		key: "\\",
	};
	expect(isSheetFocusHotkey({ ...stroke, metaKey: true, ctrlKey: false })).toBe(true);
	expect(isSheetFocusHotkey({ ...stroke, metaKey: false, ctrlKey: true })).toBe(true);
	expect(isSheetFocusHotkey({ ...stroke, metaKey: false, ctrlKey: false })).toBe(false);
	expect(
		isSheetFocusHotkey({
			...stroke,
			metaKey: true,
			ctrlKey: false,
			code: "KeyK",
			key: "k",
		}),
	).toBe(false);
	expect(sheetFocusHotkeyLabel("MacIntel")).toBe("⌘\\");
	expect(sheetFocusHotkeyLabel("Win32")).toBe("Ctrl \\");
});

test("play focus storage is a no-op without sessionStorage", () => {
	expect(readPlaySheetFocus()).toBe("both");
	expect(() => writePlaySheetFocus("write")).not.toThrow();
});
