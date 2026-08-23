import { describe, expect, test } from "vitest";
import { PIXEL_GRID, PIXEL_PALETTE, randomPixelSprite } from "./pixel-sprite";

describe("randomPixelSprite", () => {
	test("is an 8x8 4-bit grid with left-right symmetry", () => {
		let n = 0.1;
		const sprite = randomPixelSprite(() => {
			n = (n * 1.7) % 1;
			return n;
		});
		expect(sprite.size).toBe(PIXEL_GRID);
		expect(sprite.cells).toHaveLength(PIXEL_GRID * PIXEL_GRID);
		expect(PIXEL_PALETTE).toHaveLength(16);
		for (let y = 0; y < PIXEL_GRID; y += 1) {
			for (let x = 0; x < PIXEL_GRID / 2; x += 1) {
				const left = sprite.cells[y * PIXEL_GRID + x];
				const right = sprite.cells[y * PIXEL_GRID + (PIXEL_GRID - 1 - x)];
				expect(left).toBe(right);
				expect(left).toBeGreaterThanOrEqual(0);
				expect(left).toBeLessThan(PIXEL_PALETTE.length);
			}
		}
	});

	test("a different rng yields a different sprite", () => {
		const a = randomPixelSprite(() => 0.11);
		const b = randomPixelSprite(() => 0.73);
		expect(a.cells.join(",")).not.toBe(b.cells.join(","));
	});
});
