import { expect, test } from "vitest";
import { filesFromClipboard } from "./clipboard-files";

function stubFile(name: string, type: string): File {
	return new File([new Uint8Array([1, 2, 3])], name, { type });
}

test("reads an image from clipboard files", () => {
	const image = stubFile("image.png", "image/png");
	expect(filesFromClipboard({ files: [image] })).toEqual([image]);
});

test("falls back to clipboard items when files is empty", () => {
	const image = stubFile("image.png", "image/png");
	expect(
		filesFromClipboard({
			files: [],
			items: [
				{ kind: "string", getAsFile: () => null },
				{ kind: "file", getAsFile: () => image },
			],
		}),
	).toEqual([image]);
});

test("empty clipboard is not a file paste", () => {
	expect(filesFromClipboard(null)).toEqual([]);
	expect(filesFromClipboard({ files: [] })).toEqual([]);
});
