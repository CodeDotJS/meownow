import { expect, test } from "vitest";
import { edgeChunkUrl } from "./edge-chunk-url";

test("sets chunk on a download URL that has no query", () => {
	expect(edgeChunkUrl("https://edge.example/dl", "0")).toBe("https://edge.example/dl?chunk=0");
	expect(edgeChunkUrl("https://edge.example/dl", "trailer")).toBe(
		"https://edge.example/dl?chunk=trailer",
	);
});

test("replaces a second question mark with an extra search param", () => {
	expect(edgeChunkUrl("https://edge.example/dl?x=1", "0")).toBe(
		"https://edge.example/dl?x=1&chunk=0",
	);
});
