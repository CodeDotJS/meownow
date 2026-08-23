"use client";

import { useMemo, useState } from "react";
import {
	PIXEL_PALETTE,
	type PixelSprite,
	pixelSpriteFromSeed,
	randomPixelSprite,
} from "./pixel-sprite";

export function PixelAvatar({ label, size = 28 }: { label: string; size?: number }) {
	const [sprite] = useState<PixelSprite>(() => randomPixelSprite());
	return <PixelSpriteSvg className="pixel-avatar" sprite={sprite} label={label} size={size} />;
}

export function PixelThumb({ seed, label }: { seed: string; label: string }) {
	const sprite = useMemo(() => pixelSpriteFromSeed(seed), [seed]);
	return <PixelSpriteSvg className="file-thumb" sprite={sprite} label={label} size={44} />;
}

function PixelSpriteSvg({
	sprite,
	label,
	size,
	className,
}: {
	sprite: PixelSprite;
	label: string;
	size: number;
	className: string;
}) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox={`0 0 ${sprite.size} ${sprite.size}`}
			shapeRendering="crispEdges"
			role="img"
			aria-label={label}
		>
			<title>{label}</title>
			{sprite.cells.map((color, index) => {
				const x = index % sprite.size;
				const y = Math.floor(index / sprite.size);
				return (
					<rect
						key={`${x}-${y}`}
						x={x}
						y={y}
						width="1"
						height="1"
						fill={PIXEL_PALETTE[color] ?? PIXEL_PALETTE[0]}
					/>
				);
			})}
		</svg>
	);
}
