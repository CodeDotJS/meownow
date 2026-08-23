const GLYPHS = "AEIOUQYSTNH*%#+=?<>/\\";

export function scrambleFrame(text: string, t: number, rand: () => number): string {
	const progress = Math.min(1, Math.max(0, t));
	const last = Math.max(text.length - 1, 1);
	return Array.from(text, (char, index) => {
		if (char === " ") {
			return " ";
		}
		const start = (index / last) * 0.52;
		const local = (progress - start) / 0.3;
		if (local >= 1) {
			return char;
		}
		if (local <= 0 || rand() > local * local) {
			const pick = Math.floor(rand() * GLYPHS.length);
			return GLYPHS[pick] ?? char;
		}
		return char;
	}).join("");
}

export function playScramble(el: HTMLElement, text: string): () => void {
	const started = performance.now();
	const duration = 720;
	let raf = 0;

	const tick = (now: number) => {
		const t = Math.min(1, (now - started) / duration);
		el.textContent = scrambleFrame(text, t, Math.random);
		if (t < 1) {
			raf = requestAnimationFrame(tick);
		} else {
			el.textContent = text;
		}
	};

	el.textContent = scrambleFrame(text, 0, Math.random);
	raf = requestAnimationFrame(tick);

	return () => {
		cancelAnimationFrame(raf);
		el.textContent = text;
	};
}
