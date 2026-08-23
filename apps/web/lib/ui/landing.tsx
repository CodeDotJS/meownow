"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { DemoLog } from "./demo-log";
import { InstallHint } from "./install-hint";
import { playLandingMotion } from "./landing-motion";
import { SiteFooter } from "./site-footer";

export function Landing({ hasLocal }: { hasLocal: boolean }) {
	const reduce = useReducedMotion();
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const root = rootRef.current;
		if (!root || reduce) {
			return;
		}
		try {
			return playLandingMotion(root);
		} catch {
			root.classList.add("is-static");
			return () => undefined;
		}
	}, [reduce]);

	return (
		<>
			<main className={reduce ? "landing is-static" : "landing"} ref={rootRef}>
				<section className="hero">
					<div className="hero-copy">
						<h1 className="lede">
							<span className="lede-line">Copy here.</span>
							<span className="lede-line">Paste there.</span>
						</h1>
						<p className="hero-fade lead">
							A private clipboard. If someone sent you this page, ask them for an invite link.
						</p>
						<nav className="hero-fade stack">
							<a className="select" href="/login">
								Continue with passkey
							</a>
						</nav>
						{hasLocal ? (
							<p className="hero-fade hint">
								This browser already has the clipboard. Sign in to open it.
							</p>
						) : null}
						<ul className="hero-fade hint-list">
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
						<div className="hero-fade">
							<InstallHint />
						</div>
					</div>
					<div className="hero-sheet">
						<DemoLog />
					</div>
				</section>
			</main>
			<SiteFooter />
		</>
	);
}
