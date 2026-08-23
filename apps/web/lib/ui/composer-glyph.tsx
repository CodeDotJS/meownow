"use client";

import { motion, useReducedMotion } from "motion/react";

const GLYPHS = {
	send: "📤",
	ephemeral: "👻",
	file: "📎",
} as const;

export function ComposerGlyph({ name, pop = false }: { name: keyof typeof GLYPHS; pop?: boolean }) {
	const reduce = useReducedMotion();
	return (
		<motion.span
			className="composer-glyph"
			aria-hidden
			animate={
				reduce || !pop
					? { y: 0, rotate: 0, scale: 1 }
					: { y: [0, -6, 0], rotate: [0, -12, 8, 0], scale: [1, 1.2, 1] }
			}
			transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
		>
			{GLYPHS[name]}
		</motion.span>
	);
}
