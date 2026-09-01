export type ClipboardFilesSource = {
	files: ArrayLike<File>;
	items?: ArrayLike<{ kind: string; getAsFile(): File | null }>;
};

/** Prefer `files`; some browsers only expose the image on `items`. */
export function filesFromClipboard(data: ClipboardFilesSource | null | undefined): File[] {
	if (!data) {
		return [];
	}
	const fromList = Array.from(data.files);
	if (fromList.length > 0) {
		return fromList;
	}
	const fromItems: File[] = [];
	for (const item of Array.from(data.items ?? [])) {
		if (item.kind !== "file") {
			continue;
		}
		const file = item.getAsFile();
		if (file) {
			fromItems.push(file);
		}
	}
	return fromItems;
}
