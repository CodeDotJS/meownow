import { PIXEL_PALETTE, type PixelSprite } from "./pixel-sprite";

export function PixelSpriteSvg({
	sprite,
	label,
	size,
	className,
	cellClassName,
	side,
	decorative = false,
}: {
	sprite: PixelSprite;
	label: string;
	size: number;
	className: string;
	cellClassName?: string;
	side?: string;
	decorative?: boolean;
}) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox={`0 0 ${sprite.size} ${sprite.size}`}
			shapeRendering="crispEdges"
			role={decorative ? "presentation" : "img"}
			aria-hidden={decorative ? true : undefined}
			aria-label={decorative ? undefined : label}
			data-side={side}
		>
			{decorative ? null : <title>{label}</title>}
			{sprite.cells.map((color, index) => {
				const x = index % sprite.size;
				const y = Math.floor(index / sprite.size);
				return (
					<rect
						key={`${x}-${y}`}
						className={cellClassName}
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
