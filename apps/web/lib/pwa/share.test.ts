import { expect, test } from "vitest";
import { sharePayloadFromForm } from "./share";

test("share target prefers url then text then title", () => {
	const form = new FormData();
	form.set("title", "ignored if url exists");
	form.set("text", "also ignored");
	form.set("url", "https://example.com/x");
	expect(sharePayloadFromForm(form)).toEqual({
		text: "https://example.com/x",
		kind: "link",
	});
});

test("share target accepts plain text and rejects empty payloads", () => {
	const text = new FormData();
	text.set("text", "  hello from android  ");
	expect(sharePayloadFromForm(text)).toEqual({ text: "hello from android", kind: "text" });
	expect(sharePayloadFromForm(new FormData())).toBeNull();
});
