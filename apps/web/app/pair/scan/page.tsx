"use client";

import { unwrapExtractableForPairing, wrapVaultForPairing } from "@meownow/crypto";
import { asPublicJwk, type PairingQr } from "@meownow/protocol";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";
import { parsePairingQr } from "@/lib/pair/qr";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";
import { loadVault } from "@/lib/vault/idb";
import { wrapToWire } from "@/lib/vault/wire";

type Detector = {
	detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

export default function PairScanPage() {
	const [raw, setRaw] = useState("");
	const [scanning, setScanning] = useState(false);
	const [cameraOk, setCameraOk] = useState(false);
	const [fingerprint, setFingerprint] = useState<string | null>(null);
	const [pending, setPending] = useState<{
		id: string;
		wrap: {
			fingerprint: string;
			vaultWrap: ReturnType<typeof wrapToWire> & { ephPublicJwk: JsonWebKey };
			identityWrap: ReturnType<typeof wrapToWire>;
			identityPub: JsonWebKey;
		};
	} | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [scanned, setScanned] = useState<PairingQr | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);

	useEffect(() => {
		setCameraOk(typeof window !== "undefined" && "BarcodeDetector" in window);
	}, []);

	useEffect(() => {
		if (!scanning) {
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
				const Detector = (
					window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => Detector }
				).BarcodeDetector;
				const detector = new Detector({ formats: ["qr_code"] });
				const tick = async () => {
					if (cancelled || !videoRef.current) {
						return;
					}
					try {
						const found = await detector.detect(videoRef.current);
						const value = found[0]?.rawValue;
						const qr = value ? parsePairingQr(value) : null;
						if (qr) {
							cancelled = true;
							setScanning(false);
							setRaw(value ?? "");
							setScanned(qr);
							return;
						}
					} catch {
						// keep scanning
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
	}, [scanning]);

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
			setFingerprint(wrap.fingerprint);
			setPending({
				id: qr.id,
				wrap: {
					fingerprint: wrap.fingerprint,
					vaultWrap: { ...wrapToWire(wrap), ephPublicJwk: asPublicJwk(wrap.ephPublicJwk) },
					identityWrap: wrapToWire(stored.wrappedIdentity),
					identityPub: asPublicJwk(stored.identityPub),
				},
			});
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

	async function onConfirm() {
		if (!pending) {
			return;
		}
		setBusy(true);
		const res = await postJson(`/api/pairing/${pending.id}/wrap`, pending.wrap);
		if (!res.ok) {
			setStatus(errorCode(res.data));
			setBusy(false);
			return;
		}
		window.location.href = "/";
	}

	return (
		<main>
			<Panel>
				<h1>Add a device</h1>
				{fingerprint ? (
					<>
						<p className="lead">Read these numbers on both screens.</p>
						<p className="fp">{fingerprint}</p>
						<button
							className="select"
							type="button"
							onClick={() => void onConfirm()}
							disabled={busy}
						>
							Numbers match
						</button>
					</>
				) : (
					<>
						<p className="lead">Point the camera at the QR on the new browser.</p>
						{cameraOk ? (
							<>
								<video ref={videoRef} className="qr-scan" autoPlay muted playsInline />
								<button
									className="select"
									type="button"
									onClick={() => setScanning((on) => !on)}
									disabled={busy}
								>
									{scanning ? "Stop camera" : "Open camera"}
								</button>
							</>
						) : (
							<p className="hint">This browser cannot decode a QR. Paste the payload instead.</p>
						)}
						<form onSubmit={(event) => void onPrepare(event)}>
							<label>
								QR payload
								<textarea
									className="mono"
									value={raw}
									onChange={(e) => setRaw(e.target.value)}
									rows={6}
								/>
							</label>
							<button type="submit" disabled={busy}>
								Use payload
							</button>
						</form>
					</>
				)}
				<Status value={status} />
			</Panel>
		</main>
	);
}
