export type SharePayload = {
	text: string;
	kind: "text" | "link";
};

export function sharePayloadFromForm(form: FormData): SharePayload | null {
	const url = readField(form.get("url"));
	const text = readField(form.get("text"));
	const title = readField(form.get("title"));
	const candidate = url || text || title;
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
