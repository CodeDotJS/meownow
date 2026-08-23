"use client";

import { motion, useReducedMotion } from "motion/react";
import { DemoLog } from "./demo-log";
import { InstallHint } from "./install-hint";

export function Landing({ hasLocal }: { hasLocal: boolean }) {
	const reduce = useReducedMotion();
	const hidden = reduce ? false : { opacity: 0, y: 18 };

	return (
		<main className="landing">
			<section className="hero">
				<motion.div
					className="hero-copy"
					initial={hidden}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
				>
					<h1 className="lede">
						Copy here.
						<br />
						Paste there.
					</h1>
					<p className="lead">
						A private clipboard. If someone sent you this page, ask them for an invite link.
					</p>
					<nav className="stack">
						<a className="select" href="/login">
							Continue with passkey
						</a>
					</nav>
					{hasLocal ? (
						<>
							<p className="hint">This browser already has the clipboard. Sign in to open it.</p>
							<p className="hint">
								Can't use a passkey? <a href="/pair/show">Show a code</a>
							</p>
						</>
					) : (
						<ul className="hint-list">
							<li>
								Have an invite? <a href="/join">Join</a>
							</li>
							<li>
								Adding this browser? <a href="/pair/show">Show a code</a>
							</li>
							<li>
								Lost every device. <a href="/recover">Use the 12 words</a>
							</li>
							<li>
								First seat? <a href="/enroll">First admin</a>
							</li>
						</ul>
					)}
					<InstallHint />
				</motion.div>
				<motion.div
					className="hero-sheet"
					initial={hidden}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.65, delay: reduce ? 0 : 0.08, ease: [0.16, 1, 0.3, 1] }}
				>
					<p className="sheet-label">What it looks like</p>
					<DemoLog />
				</motion.div>
			</section>
		</main>
	);
}
