"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { playAboutMotion } from "./about-motion";
import { PixelSpriteSvg } from "./pixel-mark";
import { pixelSpriteFromSeed } from "./pixel-sprite";
import { SiteFooter } from "./site-footer";

const FLOW = [
	{
		id: "flow-seal",
		state: "plain",
		title: "This browser seals it",
		body: "WebCrypto AES-256-GCM, in this page, before a byte leaves. Filename, type, and preview go in the same envelope. The key stays on your devices.",
	},
	{
		id: "flow-courier",
		state: "sealed",
		title: "The courier sees ciphertext",
		body: "Servers learn owner, size, time, and kind. Not the text, the name, or the picture. A breach there still cannot read the clipboard.",
	},
	{
		id: "flow-path",
		state: "sealed",
		title: "Across, still sealed",
		body: "Same network: the payload stays on the LAN. Otherwise only sealed chunks go to the file store. Nothing readable is handed to a server.",
	},
	{
		id: "flow-open",
		state: "open",
		title: "The other browser opens it",
		body: "Decrypt happens there, in that page. Then the note expires. A handoff, not an archive.",
	},
] as const;

const JOIN = [
	{
		id: "about-in",
		title: "How you get in",
		body: "Someone already here sends an invite link. No public signup. No password. Without a link, ask them.",
	},
	{
		id: "about-passkey",
		title: "Signing in",
		body: "A passkey — Face ID, Touch ID, or the lock on this phone. Nothing to type. Nothing to reset.",
	},
	{
		id: "about-pair",
		title: "Another device",
		body: "The new browser shows a short code. The one that works types it. Both sides check a six-digit fingerprint so nothing in the middle can pretend to be you.",
	},
	{
		id: "about-words",
		title: "If every device is gone",
		body: "Setup shows twelve words once. Those words unlock the clipboard on a new browser. Keep them off this device.",
	},
	{
		id: "about-ttl",
		title: "How long things stay",
		body: "Notes expire. Files do not live here forever. A handoff, not an archive.",
	},
] as const;

export function About() {
	const reduce = useReducedMotion();
	const rootRef = useRef<HTMLElement>(null);

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

	return (
		<>
			<main className={reduce ? "about-page is-static" : "about-page"} ref={rootRef}>
				<header className="about-hero">
					<h1 className="lede">
						<span className="lede-line">A clipboard for people</span>
						<span className="lede-line">who already know each other.</span>
					</h1>
					<p className="about-fade lead">
						Copy here. Paste there. What you copy is sealed before it leaves this page.
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
							{FLOW.map((step) => (
								<li className="about-station" data-state={step.state} key={step.id}>
									<span className="about-node" aria-hidden />
									<h2>{step.title}</h2>
									<p>{step.body}</p>
								</li>
							))}
						</ol>
					</div>
				</section>

				<ol className="about-join">
					{JOIN.map((step) => (
						<li className="about-join-step about-fade" id={step.id} key={step.id}>
							<PixelSpriteSvg
								className="about-mark"
								sprite={pixelSpriteFromSeed(step.id)}
								label={step.title}
								size={28}
								decorative
							/>
							<h2>{step.title}</h2>
							<p>{step.body}</p>
						</li>
					))}
				</ol>
			</main>
			<SiteFooter />
		</>
	);
}
