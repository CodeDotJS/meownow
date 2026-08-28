"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CopyMark } from "./marks";
import { formatGutterTime } from "./time";

type DemoLine = {
	id: string;
	time: string;
	text: string;
	remain: string;
};

const POOL = [
	"3am: glass on the floor. again.",
	"tuna: the wet kind or we riot",
	"sun patch reserved 14:07–14:22",
	"human is a radiator. claiming it.",
	"hallway box is mine. do not recycle.",
	"bathroom door stays open. this is policy.",
	"bird at the window. classified.",
	"treat tax: 6. paid in purrs.",
	"red dot still at large. send backup.",
	"sofa arm: scratched. improvements ongoing.",
	"hide the charging cable under the couch",
	"empty bowl is an emergency",
	"nap schedule: yes",
	"laptop kneading until it stops typing",
] as const;

const SEED_TIMES = [
	"14:32",
	"14:31",
	"12:08",
	"11:40",
	"09:12",
	"08:44",
	"08:17",
	"07:03",
] as const;
const VISIBLE = 8;
const FIRST_AFTER_MS = 1600;
const EVERY_MS = 2400;

function remainFor(index: number): string {
	return String(Math.max(0.28, 0.94 - index * 0.11));
}

function stampNow(): string {
	const now = Date.now();
	return formatGutterTime(new Date(now).toISOString(), now);
}

function seedLines(): DemoLine[] {
	return POOL.slice(0, VISIBLE).map((text, index) => ({
		id: `seed-${index}`,
		time: SEED_TIMES[index] ?? stampNow(),
		text,
		remain: remainFor(index),
	}));
}

function nextText(visible: readonly DemoLine[], cursor: number): string {
	const used = new Set(visible.map((line) => line.text));
	for (let step = 0; step < POOL.length; step += 1) {
		const candidate = POOL[(cursor + step) % POOL.length];
		if (candidate && !used.has(candidate)) {
			return candidate;
		}
	}
	return POOL[0] ?? "3am: glass on the floor. again.";
}

export function DemoLog() {
	const reduce = useReducedMotion();
	const cursor = useRef(VISIBLE);
	const paused = useRef(false);
	const blinkTimer = useRef(0);
	const [lines, setLines] = useState<DemoLine[]>(seedLines);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>("seed-0");
	const [blink, setBlink] = useState(false);

	useEffect(() => {
		if (reduce) {
			return;
		}

		const push = () => {
			if (paused.current || document.visibilityState === "hidden") {
				return;
			}
			const seq = cursor.current;
			cursor.current = seq + 1;
			const id = `in-${seq}`;
			setLines((current) => [
				{
					id,
					time: stampNow(),
					text: nextText(current, seq),
					remain: remainFor(0),
				},
				...current.slice(0, VISIBLE - 1),
			]);
			setSelectedId(id);
			setBlink(true);
			window.clearTimeout(blinkTimer.current);
			blinkTimer.current = window.setTimeout(() => setBlink(false), 420);
		};

		let tick = 0;
		const start = window.setTimeout(() => {
			push();
			tick = window.setInterval(push, EVERY_MS);
		}, FIRST_AFTER_MS);
		return () => {
			window.clearTimeout(start);
			window.clearInterval(tick);
			window.clearTimeout(blinkTimer.current);
		};
	}, [reduce]);

	useEffect(() => {
		if (!copiedId) {
			return;
		}
		const timer = window.setTimeout(() => setCopiedId(null), 1600);
		return () => window.clearTimeout(timer);
	}, [copiedId]);

	return (
		<>
			<div className="log-head">
				<p className="sheet-label">On the clipboard</p>
				<div className="sheet-meta">
					<EyeMark className={blink ? "sheet-eye is-blink" : "sheet-eye"} size={22} decorative />
					<p className="clip-count">{lines.length}</p>
				</div>
			</div>
			<ul
				className="log log-sheet landing-log"
				onMouseEnter={() => {
					paused.current = true;
				}}
				onMouseLeave={() => {
					paused.current = false;
				}}
				onFocus={() => {
					paused.current = true;
				}}
				onBlur={(event) => {
					const next = event.relatedTarget;
					if (next instanceof Node && event.currentTarget.contains(next)) {
						return;
					}
					paused.current = false;
				}}
			>
				<AnimatePresence initial={false}>
					{lines.map((line) => {
						const selected = line.id === selectedId;
						return (
							<motion.li
								key={line.id}
								layout={reduce ? false : "position"}
								initial={reduce ? false : { opacity: 0, y: "-100%" }}
								animate={{ opacity: 1, y: 0 }}
								exit={reduce ? undefined : { opacity: 0, y: "30%" }}
								transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
								className={selected ? "log-item is-selected" : "log-item"}
							>
								<span className="gutter">{line.time}</span>
								<p className="body">{line.text}</p>
								<span className="log-actions">
									{copiedId === line.id ? (
										<span className="copied">Copied</span>
									) : (
										<button
											type="button"
											className="act act-icon"
											aria-label="Copy"
											onClick={() => {
												void navigator.clipboard.writeText(line.text).then(
													() => {
														setCopiedId(line.id);
														setSelectedId(line.id);
													},
													() => setCopiedId(null),
												);
											}}
										>
											<CopyMark size={15} decorative />
										</button>
									)}
								</span>
								<span className="ttl" style={{ ["--remain" as string]: line.remain }} />
							</motion.li>
						);
					})}
				</AnimatePresence>
			</ul>
		</>
	);
}
