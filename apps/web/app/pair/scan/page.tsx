"use client";

import { unwrapExtractableForPairing, wrapVaultForPairing } from "@meownow/crypto";
import { asPublicJwk, type PairingQr } from "@meownow/protocol";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import { parsePairingQr } from "@/lib/pair/qr";
import { readPairingQrFromVideo } from "@/lib/pair/read-qr";
import { PairSteps } from "@/lib/ui/pair-steps";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";
import { loadVault } from "@/lib/vault/idb";
import { wrapToWire } from "@/lib/vault/wire";

export default function PairScanPage() {
	const [raw, setRaw] = useState("");
	const [code, setCode] = useState("");
	const [scanning, setScanning] = useState(false);
	const [fingerprint, setFingerprint] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [gate, setGate] = useState<"loading" | "signin" | "new-browser" | "ready">("loading");
	const [scanned, setScanned] = useState<PairingQr | null>(null);
	const [sent, setSent] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const streamRef = useRef<MediaStream | null>(null);

	useEffect(() => {
		void (async () => {
			const [stored, me] = await Promise.all([loadVault(), getJson("/api/auth/me")]);
			if (!me.ok) {
				setGate("signin");
				return;
			}
			if (!stored) {
				setGate("new-browser");
				return;
			}
			setGate("ready");
		})();
	}, []);

	useEffect(() => {
		if (!scanning || scanned) {
			const idle = streamRef.current;
			streamRef.current = null;
			if (idle) {
				for (const track of idle.getTracks()) {
					track.stop();
				}
			}
			if (videoRef.current) {
				videoRef.current.srcObject = null;
			}
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: { ideal: "environment" } },
					audio: false,
				});
				if (cancelled) {
					for (const track of stream.getTracks()) {
						track.stop();
					}
					return;
				}
				streamRef.current = stream;
				const video = videoRef.current;
				if (!video) {
					return;
				}
				video.srcObject = stream;
				await video.play();
				const tick = async () => {
					if (cancelled || !videoRef.current || !canvasRef.current) {
						return;
					}
					const found = await readPairingQrFromVideo(videoRef.current, canvasRef.current);
					if (found) {
						cancelled = true;
						setScanning(false);
						setRaw(found.raw);
						setScanned(found.qr);
						return;
					}
					window.requestAnimationFrame(() => {
						void tick();
					});
				};
				void tick();
			} catch {
				setStatus("camera_denied");
				setScanning(false);
			}
		})();
		return () => {
			cancelled = true;
			const stream = streamRef.current;
			streamRef.current = null;
			if (stream) {
				for (const track of stream.getTracks()) {
					track.stop();
				}
			}
			if (videoRef.current) {
				videoRef.current.srcObject = null;
			}
		};
	}, [scanning, scanned]);

	const prepare = useCallback(async (qr: PairingQr) => {
		setBusy(true);
		setStatus(null);
		try {
			const stored = await loadVault();
			if (!stored) {
				setStatus("vault_missing");
				return;
			}
			const extractable = await unwrapExtractableForPairing(
				stored.deviceKey,
				stored.wrappedExtractable,
			);
			const wrap = await wrapVaultForPairing(extractable, qr.publicJwk);
			const body = {
				fingerprint: wrap.fingerprint,
				vaultWrap: { ...wrapToWire(wrap), ephPublicJwk: asPublicJwk(wrap.ephPublicJwk) },
				identityWrap: wrapToWire(stored.wrappedIdentity),
				identityPub: asPublicJwk(stored.identityPub),
			};
			const res = await postJson(`/api/pairing/${qr.id}/wrap`, body);
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
			setFingerprint(wrap.fingerprint);
			setSent(true);
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "wrap_failed");
		} finally {
			setBusy(false);
		}
	}, []);

	useEffect(() => {
		if (!scanned) {
			return;
		}
		void prepare(scanned);
	}, [scanned, prepare]);

	async function onCode(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setStatus(null);
		try {
			const res = await postJson("/api/pairing/lookup", { code });
			if (!res.ok) {
				const failed = errorCode(res.data);
				setStatus(failed === "unauthorized" ? "scan_needs_signin" : failed);
				return;
			}
			const found = res.data as { id: string; publicJwk: PairingQr["publicJwk"] };
			await prepare({ v: 1, id: found.id, publicJwk: found.publicJwk });
		} finally {
			setBusy(false);
		}
	}

	async function onPrepare(event: FormEvent) {
		event.preventDefault();
		const qr = parsePairingQr(raw);
		if (!qr) {
			setStatus("invalid_body");
			return;
		}
		await prepare(qr);
	}

	if (gate === "loading") {
		return (
			<main>
				<Panel>
					<h1>Add a device</h1>
					<p className="lead">Checking this browser.</p>
				</Panel>
			</main>
		);
	}

	if (gate === "signin") {
		return (
			<main>
				<Panel>
					<h1>Sign in on this browser first</h1>
					<p className="lead">
						Add a device is for the computer that already has the clipboard. Sign in here, then type
						the code from the new browser.
					</p>
					<nav className="stack">
						<a className="select" href="/login?next=/pair/scan">
							Continue with passkey
						</a>
					</nav>
					<ul className="hint-list">
						<li>
							This browser is new? <a href="/pair/show">Show a code</a>
						</li>
						<li>
							Lost every device? <a href="/recover">Use the 12 words</a>
						</li>
					</ul>
				</Panel>
			</main>
		);
	}

	if (gate === "new-browser") {
		return (
			<main>
				<Panel>
					<h1>This browser is new</h1>
					<p className="lead">
						It can sign in, but it has no keys yet. Show a code here. On the computer that already
						works, tap Add a device and type it.
					</p>
					<nav className="stack">
						<a className="select" href="/pair/show">
							Show a code
						</a>
					</nav>
				</Panel>
			</main>
		);
	}

	return (
		<main>
			<Panel>
				<h1>Add a device</h1>
				{fingerprint ? (
					<div className="fp-sheet">
						<p className="lead">If the numbers differ, stop.</p>
						<p className="fp">{fingerprint}</p>
						{sent ? <p className="hint">The other screen still has to tap Numbers match.</p> : null}
						<a className="select" href="/">
							Back to clipboard
						</a>
					</div>
				) : (
					<>
						<p className="lead">Type the code the new browser is showing.</p>
						<PairSteps side="working" />
						<form onSubmit={(event) => void onCode(event)}>
							<label>
								Code
								<input
									className="mono pair-code-input"
									value={code}
									onChange={(e) => setCode(e.target.value.toUpperCase())}
									autoComplete="off"
									autoCapitalize="characters"
									autoCorrect="off"
									spellCheck={false}
									inputMode="text"
									placeholder="7K3M-2Q9P"
									maxLength={9}
									required
								/>
							</label>
							<button className="select" type="submit" disabled={busy}>
								{busy ? "Working…" : "Use code"}
							</button>
						</form>
						<video ref={videoRef} className="qr-scan" autoPlay muted playsInline />
						<canvas ref={canvasRef} className="file-hidden" aria-hidden />
						<nav className="stack">
							<button type="button" onClick={() => setScanning((on) => !on)} disabled={busy}>
								{scanning ? "Stop camera" : "Scan QR"}
							</button>
						</nav>
						<form onSubmit={(event) => void onPrepare(event)}>
							<label>
								Paste QR text
								<textarea
									className="mono"
									value={raw}
									onChange={(e) => setRaw(e.target.value)}
									rows={4}
								/>
							</label>
							<button type="submit" disabled={busy}>
								Use QR text
							</button>
						</form>
					</>
				)}
				<Status value={status} />
			</Panel>
		</main>
	);
}
