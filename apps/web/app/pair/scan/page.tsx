"use client";

import { unwrapExtractableForPairing, wrapVaultForPairing } from "@meownow/crypto";
import { asPublicJwk, type PairingQr } from "@meownow/protocol";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";
import { parsePairingQr } from "@/lib/pair/qr";
import { readPairingQrFromVideo } from "@/lib/pair/read-qr";
import { PairRoles } from "@/lib/ui/pair-roles";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";
import { loadVault } from "@/lib/vault/idb";
import { wrapToWire } from "@/lib/vault/wire";

export default function PairScanPage() {
	const [raw, setRaw] = useState("");
	const [scanning, setScanning] = useState(false);
	const [fingerprint, setFingerprint] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [scanned, setScanned] = useState<PairingQr | null>(null);
	const [sent, setSent] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const streamRef = useRef<MediaStream | null>(null);

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

	async function onPrepare(event: FormEvent) {
		event.preventDefault();
		const qr = parsePairingQr(raw);
		if (!qr) {
			setStatus("invalid_body");
			return;
		}
		await prepare(qr);
	}

	return (
		<main>
			<Panel>
				<PairRoles current="scan" />
				<h1>Scan</h1>
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
						<p className="lead">
							Point this camera at the QR on the new device. Scan inside meownow, not the phone
							Camera app.
						</p>
						<video ref={videoRef} className="qr-scan" autoPlay muted playsInline />
						<canvas ref={canvasRef} className="file-hidden" aria-hidden />
						<nav className="stack">
							<button
								className="select"
								type="button"
								onClick={() => setScanning((on) => !on)}
								disabled={busy}
							>
								{scanning ? "Stop camera" : busy ? "Working…" : "Scan"}
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
