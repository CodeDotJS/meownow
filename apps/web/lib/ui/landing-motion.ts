import { createTimeline, stagger } from "animejs";

export function playLandingMotion(root: HTMLElement): () => void {
	const lede = root.querySelectorAll(".lede-line");
	const rest = root.querySelectorAll(".hero-fade");
	const sheet = root.querySelector(".hero-sheet");
	if (!sheet || lede.length === 0) {
		return () => undefined;
	}

	const tl = createTimeline({
		defaults: { ease: "out(3)" },
	});

	tl.add(
		lede,
		{
			opacity: [0, 1],
			translateY: [14, 0],
			duration: 520,
			delay: stagger(120),
		},
		0,
	);
	tl.add(
		rest,
		{
			opacity: [0, 1],
			translateY: [8, 0],
			duration: 400,
			delay: stagger(60),
		},
		240,
	);
	tl.add(
		sheet,
		{
			opacity: [0, 1],
			translateY: [16, 0],
			duration: 480,
		},
		320,
	);

	return () => {
		tl.revert();
	};
}
