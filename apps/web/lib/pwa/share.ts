export type SharePayload = {
	text: string;
	kind: "text" | "link";
};

export function sharePayloadFromForm(form: FormData): SharePayload | null {
	const url = readField(form.get("url"));
	const text = readField(form.get("text"));
	const title = readField(form.get("title"));
	const extracted = firstHttpUrl(url) || firstHttpUrl(text) || firstHttpUrl(title);
	if (extracted) {
		return { text: extracted, kind: "link" };
	}
	const candidate = url || text || title || firstStringField(form);
	if (!candidate) {
		return null;
	}
	const kind = looksLikeUrl(candidate) ? "link" : "text";
	return { text: candidate, kind };
}

function readField(value: FormDataEntryValue | null): string {
	if (typeof value !== "string") {
		return "";
	}
	return value.trim();
}

function looksLikeUrl(value: string): boolean {
	return /^https?:\/\//i.test(value);
}

function firstHttpUrl(value: string): string | null {
	const match = value.match(/https?:\/\/[^\s<>"']+/i);
	return match?.[0] ?? null;
}

function firstStringField(form: FormData): string {
	for (const value of form.values()) {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return "";
}
