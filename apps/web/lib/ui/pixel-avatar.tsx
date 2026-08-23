"use client";

import { useState } from "react";
import { PIXEL_PALETTE, type PixelSprite, randomPixelSprite } from "./pixel-sprite";

export function PixelAvatar({ label, size = 28 }: { label: string; size?: number }) {
	const [sprite] = useState<PixelSprite>(() => randomPixelSprite());
	return (
		<svg
			className="pixel-avatar"
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
