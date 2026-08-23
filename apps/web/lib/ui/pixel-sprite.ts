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
	size: number;
	cells: number[];
};

export function pixelSpriteFromSeed(seed: string, size: number = PIXEL_GRID): PixelSprite {
	return randomPixelSprite(mulberry32(fnv1a(seed)), size);
}

export function randomPixelSprite(
	rng: () => number = Math.random,
	size: number = PIXEL_GRID,
): PixelSprite {
	const cells: number[] = [];
	const paper = 5;
	const inks = [index(rng), index(rng), index(rng)];
	const half = Math.ceil(size / 2);
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < half; x += 1) {
			const roll = rng();
			const color = roll < 0.42 ? paper : (inks[Math.floor(rng() * inks.length)] ?? paper);
			cells[y * size + x] = color;
			cells[y * size + (size - 1 - x)] = color;
		}
	}
	return { size, cells };
}

function index(rng: () => number): number {
	return Math.min(PIXEL_PALETTE.length - 1, Math.floor(rng() * PIXEL_PALETTE.length));
}

function fnv1a(input: string): number {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
