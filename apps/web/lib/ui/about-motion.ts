import { createTimeline, stagger, utils } from "animejs";
import { playScramble } from "./about-scramble";

const SLIP_STATES = ["plain", "sealed", "sealed", "open"] as const;
const HOLD_MS = 1100;

function parkSlip(slip: HTMLElement, stations: HTMLElement[]): number[] {
	return stations.map((station) => {
		return station.offsetLeft + station.offsetWidth / 2 - slip.offsetWidth / 2;
	});
}

function setSlipState(slip: HTMLElement, state: (typeof SLIP_STATES)[number]): void {
	slip.dataset.state = state;
}

function playSlip(slip: HTMLElement, stations: HTMLElement[]): () => void {
	if (window.matchMedia("(max-width: 959px)").matches || stations.length === 0) {
		setSlipState(slip, "plain");
		return () => undefined;
	}

	const xs = parkSlip(slip, stations);
	const first = xs[0] ?? 0;
	utils.set(slip, { x: first });
	setSlipState(slip, "plain");

	const tl = createTimeline({
		defaults: { ease: "inOut(3)" },
		loop: true,
	});

	xs.forEach((x, index) => {
		if (index === 0) {
			return;
		}
		const state = SLIP_STATES[index] ?? "sealed";
		tl.add(slip, {
			x,
			duration: 640,
			delay: HOLD_MS,
			onBegin: () => {
				setSlipState(slip, state);
			},
		});
	});
	tl.add(slip, {
		x: first,
		duration: 1,
		delay: HOLD_MS,
		onBegin: () => {
			setSlipState(slip, "plain");
		},
	});

	return () => {
		tl.revert();
		utils.set(slip, { x: 0 });
		setSlipState(slip, "plain");
	};
}

export function playAboutMotion(root: HTMLElement): () => void {
	const lede = root.querySelectorAll(".lede-line");
	const flow = root.querySelector(".about-flow");
	const stations = root.querySelectorAll(".about-station");
	const nodes = root.querySelectorAll(".about-node");
	const rest = root.querySelectorAll(".about-fade:not(.about-break):not(.about-faq)");
	const breakEl = root.querySelector(".about-break");
	const faq = root.querySelector(".about-faq");
	const cipher = root.querySelector(".about-scramble");
	const slip = root.querySelector(".about-slip");
	if (!flow || lede.length === 0 || !(slip instanceof HTMLElement)) {
		return () => undefined;
	}

	const stationEls = Array.from(stations).filter(
		(node): node is HTMLElement => node instanceof HTMLElement,
	);
	let stopSlip = playSlip(slip, stationEls);
	let stopCipher: () => void = () => undefined;

	const tl = createTimeline({
		defaults: { ease: "out(3)" },
	});

	tl.add(
		lede,
		{
			opacity: [0, 1],
			translateY: [14, 0],
			duration: 520,
			delay: stagger(110),
		},
		0,
	);
	tl.add(
		flow,
		{
			opacity: [0, 1],
			translateY: [16, 0],
			duration: 480,
		},
		180,
	);
	tl.add(
		stations,
		{
			opacity: [0, 1],
			translateY: [10, 0],
			duration: 400,
			delay: stagger(90),
		},
		300,
	);
	tl.add(
		nodes,
		{
			scale: [0.45, 1],
			duration: 360,
			delay: stagger(90),
		},
		300,
	);
	tl.add(
		rest,
		{
			opacity: [0, 1],
			translateY: [10, 0],
			duration: 420,
			delay: stagger(70),
		},
		520,
	);
	if (breakEl) {
		tl.add(
			breakEl,
			{
				opacity: [0, 1],
				translateY: [12, 0],
				duration: 420,
				onBegin: () => {
					if (cipher instanceof HTMLElement) {
						stopCipher();
						stopCipher = playScramble(cipher, cipher.dataset.scramble ?? cipher.textContent ?? "");
					}
				},
			},
			640,
		);
	}
	if (faq) {
		tl.add(
			faq,
			{
				opacity: [0, 1],
				translateY: [10, 0],
				duration: 420,
			},
			820,
		);
	}

	const onResize = () => {
		stopSlip();
		stopSlip = playSlip(slip, stationEls);
	};
	window.addEventListener("resize", onResize);

	return () => {
		window.removeEventListener("resize", onResize);
		stopSlip();
		stopCipher();
		tl.revert();
	};
}
