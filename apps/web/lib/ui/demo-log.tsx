"use client";

import { animate } from "animejs";
import { useEffect, useRef, useState } from "react";

export const DEMO_LINES = [
	{ time: "14:32", text: "copy here" },
	{ time: "14:31", text: "paste there" },
	{ time: "09:12", text: "ten seats. encrypted." },
] as const;

export function DemoLog() {
	const ttlRef = useRef<HTMLSpanElement>(null);
	const [copied, setCopied] = useState<string | null>(null);

	useEffect(() => {
		const ttl = ttlRef.current;
		if (!ttl) {
			return;
		}
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}
		animate(ttl, {
			scaleX: [0, 0.82],
			duration: 720,
			ease: "out(2)",
			delay: 180,
		});
	}, []);

	return (
		<>
			<ul className="log landing-log">
				{DEMO_LINES.map((line, index) => (
					<li key={line.time} className="log-item">
						<span className="gutter mono">{line.time}</span>
						<button
							type="button"
							className="body mono"
							onClick={() => {
								void navigator.clipboard.writeText(line.text).then(
									() => setCopied(line.text),
									() => setCopied(null),
								);
							}}
						>
							{line.text}
						</button>
						<span
							ref={index === 0 ? ttlRef : undefined}
							className="ttl"
							style={{ ["--remain" as string]: index === 0 ? "0.82" : "0.54" }}
						/>
					</li>
				))}
			</ul>
			{copied ? (
				<p className="status" role="status">
					Copied.
				</p>
			) : null}
		</>
	);
}
