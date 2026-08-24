"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ABOUT_FAQ, ABOUT_FAQ_COL, ABOUT_FAQ_TITLE, ABOUT_FLOW } from "./about-copy";
import { playAboutMotion } from "./about-motion";
import { HoverTip } from "./hover-tip";
import { SiteFooter } from "./site-footer";

const FAQ_EASE = [0.22, 1, 0.36, 1] as const;
const FAQ_MS = 220;
const FAQ_STAGGER = 0.028;

function faqFromHash(): string | null {
	const id = window.location.hash.replace("#", "");
	return ABOUT_FAQ.some((row) => row.id === id) ? id : null;
}

function FaqRow({
	row,
	isOpen,
	delay,
	reduce,
	onOpenChange,
}: {
	row: (typeof ABOUT_FAQ)[number];
	isOpen: boolean;
	delay: number;
	reduce: boolean;
	onOpenChange: (id: string, next: boolean) => void;
}) {
	return (
		<div className={isOpen ? "about-faq-item is-open" : "about-faq-item"} id={row.id}>
			<button
				type="button"
				className="about-faq-ask"
				aria-expanded={isOpen}
				aria-controls={`${row.id}-a`}
				onClick={() => {
					onOpenChange(row.id, !isOpen);
				}}
			>
				{row.q}
			</button>
			<motion.div
				className="about-faq-body"
				id={`${row.id}-a`}
				initial={false}
				animate={isOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
				transition={{
					duration: reduce ? 0 : FAQ_MS / 1000,
					delay: reduce ? 0 : delay,
					ease: FAQ_EASE,
				}}
				aria-hidden={!isOpen}
			>
				<p>{row.a}</p>
			</motion.div>
		</div>
	);
}

export function About() {
	const reduceMotion = useReducedMotion();
	const reduce = Boolean(reduceMotion);
	const rootRef = useRef<HTMLElement>(null);
	const bulkTimer = useRef<number>(0);
	const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
	const [bulk, setBulk] = useState(false);
	const anyOpen = open.size > 0;

	useEffect(() => {
		const root = rootRef.current;
		if (!root || reduce) {
			return;
		}
		try {
			return playAboutMotion(root);
		} catch {
			root.classList.add("is-static");
			return () => undefined;
		}
	}, [reduce]);

	useEffect(() => {
		function applyHash(): void {
			const id = faqFromHash();
			if (!id) {
				return;
			}
			setOpen((current) => new Set(current).add(id));
		}
		applyHash();
		window.addEventListener("hashchange", applyHash);
		return () => {
			window.removeEventListener("hashchange", applyHash);
		};
	}, []);

	function setItemOpen(id: string, next: boolean): void {
		setOpen((current) => {
			const copy = new Set(current);
			if (next) {
				copy.add(id);
			} else {
				copy.delete(id);
			}
			return copy;
		});
	}

	function toggleAll(): void {
		window.clearTimeout(bulkTimer.current);
		if (!reduce) {
			setBulk(true);
			bulkTimer.current = window.setTimeout(
				() => {
					setBulk(false);
				},
				FAQ_MS + (ABOUT_FAQ_COL - 1) * FAQ_STAGGER * 1000 + 40,
			);
		}
		setOpen(anyOpen ? new Set() : new Set(ABOUT_FAQ.map((row) => row.id)));
	}

	useEffect(() => {
		return () => {
			window.clearTimeout(bulkTimer.current);
		};
	}, []);

	return (
		<>
			<main className={reduce ? "about-page is-static" : "about-page"} ref={rootRef}>
				<header className="about-hero">
					<h1 className="lede">
						<span className="lede-line">A clipboard for people</span>
						<span className="lede-line">who already know each other.</span>
					</h1>
					<p className="about-fade lead">
						Copy here. Paste there. What you copy is sealed before it leaves your browser.
					</p>
				</header>

				<section className="about-flow" aria-label="How this works">
					<div className="about-flow-head">
						<p className="sheet-label">How this works</p>
						<p className="about-flow-kicker">The key never leaves your devices.</p>
					</div>
					<div className="about-track">
						<div className="about-slip" data-state="plain" aria-hidden>
							<span className="about-slip-plain">the note</span>
							<span className="about-slip-sealed">sealed</span>
							<span className="about-slip-open">opened</span>
						</div>
						<ol className="about-stations">
							{ABOUT_FLOW.map((step) => (
								<li className="about-station" data-state={step.state} key={step.id}>
									<span className="about-node" aria-hidden />
									<h2>{step.title}</h2>
									<p>{step.body}</p>
								</li>
							))}
						</ol>
					</div>
				</section>

				<div className="about-break about-fade">
					<h2 className="about-break-title" id="about-faq-title" aria-label={ABOUT_FAQ_TITLE}>
						<span className="about-scramble" data-scramble={ABOUT_FAQ_TITLE} aria-hidden>
							{ABOUT_FAQ_TITLE}
						</span>
					</h2>
					<span className="about-break-rule" aria-hidden />
				</div>

				<section className="about-faq about-fade" aria-labelledby="about-faq-title">
					<div className="about-faq-head">
						<p className="about-flow-kicker">
							How you get in, what lasts, and what this browser can do.
						</p>
						<HoverTip label={anyOpen ? "Close all" : "Open all"} place="below">
							<button
								type="button"
								className={anyOpen ? "about-faq-toggle is-on" : "about-faq-toggle"}
								aria-label={anyOpen ? "Close all questions" : "Open all questions"}
								aria-pressed={anyOpen}
								onClick={toggleAll}
							>
								<span className="about-faq-toggle-glyph" aria-hidden>
									<AnimatePresence initial={false} mode="wait">
										<motion.span
											key={anyOpen ? "shut" : "open"}
											initial={reduce ? false : { opacity: 0, scale: 0.72, rotate: -14 }}
											animate={{ opacity: 1, scale: 1, rotate: 0 }}
											exit={reduce ? undefined : { opacity: 0, scale: 0.72, rotate: 14 }}
											transition={{ duration: reduce ? 0 : 0.18, ease: FAQ_EASE }}
										>
											{anyOpen ? "📕" : "📖"}
										</motion.span>
									</AnimatePresence>
								</span>
							</button>
						</HoverTip>
					</div>
					<div className="about-faq-cols">
						{[ABOUT_FAQ.slice(0, ABOUT_FAQ_COL), ABOUT_FAQ.slice(ABOUT_FAQ_COL)].map(
							(col, index) => (
								<div className="about-faq-col" key={index === 0 ? "faq-left" : "faq-right"}>
									{col.map((row, rowIndex) => (
										<FaqRow
											key={row.id}
											row={row}
											isOpen={open.has(row.id)}
											delay={bulk ? rowIndex * FAQ_STAGGER : 0}
											reduce={reduce}
											onOpenChange={setItemOpen}
										/>
									))}
								</div>
							),
						)}
					</div>
				</section>
			</main>
			<SiteFooter />
		</>
	);
}
