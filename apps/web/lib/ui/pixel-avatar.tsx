"use client";

import { useMemo, useState } from "react";
import { PixelSpriteSvg } from "./pixel-mark";
import { type PixelSprite, pixelSpriteFromSeed, randomPixelSprite } from "./pixel-sprite";

export function PixelAvatar({ label, size = 28 }: { label: string; size?: number }) {
	const [sprite] = useState<PixelSprite>(() => randomPixelSprite());
	return <PixelSpriteSvg className="pixel-avatar" sprite={sprite} label={label} size={size} />;
}

export function PixelThumb({ seed, label }: { seed: string; label: string }) {
	const sprite = useMemo(() => pixelSpriteFromSeed(seed), [seed]);
	return <PixelSpriteSvg className="file-thumb" sprite={sprite} label={label} size={44} />;
}
