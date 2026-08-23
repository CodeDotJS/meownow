import { expect, test } from "vitest";
import { scrambleFrame } from "./about-scramble";

test("locks the word when the scramble finishes", () => {
	expect(scrambleFrame("Questions", 1, () => 0)).toBe("Questions");
});

test("keeps length and spaces while glyphs flip", () => {
	const frame = scrambleFrame("A B", 0, () => 0);
	expect(frame).toHaveLength(3);
	expect(frame[1]).toBe(" ");
	expect(frame).not.toBe("A B");
});

test("settles left to right", () => {
	const early = scrambleFrame("Questions", 0.2, () => 0);
	expect(early.startsWith("Q")).toBe(true);
	expect(early.endsWith("s")).toBe(false);
});
