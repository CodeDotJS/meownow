/** 4-bit palette — sixteen colors, no neon. */
export const PIXEL_PALETTE = [
	"#17181c",
	"#2a2d34",
	"#4d525c",
	"#8b909a",
	"#c5c8ce",
	"#eef0f3",
	"#ffffff",
	"#b42332",
	"#8a5a3a",
	"#5c6b4a",
	"#3d5a6c",
	"#6b5a4a",
	"#7a6f5d",
	"#9aa0a8",
	"#d4c4a8",
	"#5a6a7a",
] as const;

export const PIXEL_GRID = 8;

export type PixelSprite = {
	size: typeof PIXEL_GRID;
	cells: number[];
};

export function randomPixelSprite(rng: () => number = Math.random): PixelSprite {
	const cells: number[] = [];
	const paper = 5;
	const inks = [index(rng), index(rng), index(rng)];
	for (let y = 0; y < PIXEL_GRID; y += 1) {
		for (let x = 0; x < PIXEL_GRID / 2; x += 1) {
			const roll = rng();
			const color = roll < 0.42 ? paper : (inks[Math.floor(rng() * inks.length)] ?? paper);
			cells[y * PIXEL_GRID + x] = color;
			cells[y * PIXEL_GRID + (PIXEL_GRID - 1 - x)] = color;
		}
	}
	return { size: PIXEL_GRID, cells };
}

function index(rng: () => number): number {
	return Math.min(PIXEL_PALETTE.length - 1, Math.floor(rng() * PIXEL_PALETTE.length));
}
