"use client";

import {
	fingerprintSharedSecret,
	generatePairingKeyPair,
	generateVaultKey,
	publicJwk,
	unwrapExtractableFromPairing,
	unwrapIdentityKey,
	wrapExtractableForDevice,
} from "@meownow/crypto";
import { asPublicJwk, formatPairingCode, type PairingQr } from "@meownow/protocol";
import { startRegistration } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import { PairingQrCanvas } from "@/lib/pair/qr-canvas";
import { PairRoles } from "@/lib/ui/pair-roles";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";
import { saveVault } from "@/lib/vault/idb";
import { wrapFromWire } from "@/lib/vault/wire";

type WrapPayload = {
	fingerprint: string;
	vaultWrap: { iv: string; bytes: string; ephPublicJwk: JsonWebKey };
	identityWrap: { iv: string; bytes: string };
	identityPub: JsonWebKey;
};

export default function PairShowPage() {
	const [payload, setPayload] = useState("");
	const [fingerprint, setFingerprint] = useState<string | null>(null);
	const [wrap, setWrap] = useState<WrapPayload | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [code, setCode] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState<"code" | "qr" | null>(null);

	useEffect(() => {
		void (async () => {
			const pair = await generatePairingKeyPair();
			const pub = await publicJwk(pair.publicKey);
			const res = await postJson("/api/pairing", { publicJwk: asPublicJwk(pub) });
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
			const started = res.data as { id: string; code: string };
			setPrivateKey(pair.privateKey);
			setSessionId(started.id);
			setCode(started.code);
			const qr: PairingQr = { v: 1, id: started.id, publicJwk: asPublicJwk(pub) };
			setPayload(JSON.stringify(qr));
		})();
	}, []);

	useEffect(() => {
		if (!sessionId || !privateKey || wrap) {
			return;
		}
		let cancelled = false;
		async function tick() {
			const res = await getJson(`/api/pairing/${sessionId}`);
			if (cancelled) {
				return;
			}
			if (!res.ok) {
				if (res.status === 400 || res.status === 404) {
					setStatus(errorCode(res.data));
				}
				return;
			}
			const data = res.data as { wrap: WrapPayload | null };
			if (!data.wrap || !privateKey) {
				return;
			}
			const fp = await fingerprintSharedSecret(privateKey, data.wrap.vaultWrap.ephPublicJwk);
			if (cancelled) {
				return;
			}
			setFingerprint(fp);
			setWrap(data.wrap);
		}
		void tick();
		const timer = window.setInterval(() => {
			void tick();
		}, 400);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [sessionId, privateKey, wrap]);

	async function onConfirm() {
		if (!sessionId || !privateKey || !wrap || !fingerprint) {
			return;
		}
		if (wrap.fingerprint !== fingerprint) {
			setStatus("fingerprint mismatch");
			return;
		}
		setBusy(true);
		try {
			const extractable = await unwrapExtractableFromPairing(privateKey, {
				...wrapFromWire(wrap.vaultWrap),
				ephPublicJwk: wrap.vaultWrap.ephPublicJwk,
				fingerprint: wrap.fingerprint,
			});
			const deviceKey = await generateVaultKey();
			const wrappedExtractable = await wrapExtractableForDevice(deviceKey, extractable);
			const raw = await crypto.subtle.exportKey("raw", extractable);
			const vaultKey = await crypto.subtle.importKey(
				"raw",
				raw,
				{ name: "AES-GCM", length: 256 },
				false,
				["encrypt", "decrypt", "wrapKey", "unwrapKey"],
			);
			await unwrapIdentityKey(vaultKey, wrapFromWire(wrap.identityWrap));
			await saveVault({
				userId: sessionId,
				vaultKey,
				deviceKey,
				wrappedExtractable,
				wrappedIdentity: wrapFromWire(wrap.identityWrap),
				identityPub: wrap.identityPub,
			});
			const optionsRes = await postJson(`/api/pairing/${sessionId}/register/options`, {
				deviceLabel: "this device",
			});
			if (!optionsRes.ok) {
				setStatus(errorCode(optionsRes.data));
				return;
			}
			const options = optionsRes.data as {
				options: Parameters<typeof startRegistration>[0]["optionsJSON"];
			};
			const credential = await startRegistration({ optionsJSON: options.options });
			const verifyRes = await postJson(`/api/pairing/${sessionId}/register/verify`, { credential });
			if (!verifyRes.ok) {
				setStatus(errorCode(verifyRes.data));
				return;
			}
			window.location.href = "/";
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "pair_failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main>
			<Panel>
				<PairRoles current="show" />
				<h1>Show a code</h1>
				<p className="lead">
					On the other computer tap Scan and type this code. On a phone, scan the QR instead.
				</p>
				{code ? (
					<>
						<p className="pair-code mono">{formatPairingCode(code)}</p>
						<button
							type="button"
							onClick={() => {
								void navigator.clipboard.writeText(formatPairingCode(code)).then(
									() => setCopied("code"),
									() => setStatus("copy_failed"),
								);
							}}
						>
							{copied === "code" ? "Copied code" : "Copy code"}
						</button>
					</>
				) : (
					<p className="hint">Making a code.</p>
				)}
				{payload ? <PairingQrCanvas payload={payload} /> : null}
				{payload ? (
					<button
						type="button"
						onClick={() => {
							void navigator.clipboard.writeText(payload).then(
								() => setCopied("qr"),
								() => setStatus("copy_failed"),
							);
						}}
					>
						{copied === "qr" ? "Copied QR text" : "Copy QR text"}
					</button>
				) : null}
				{fingerprint ? (
					<div className="fp-sheet">
						<p className="lead">If the numbers differ, stop.</p>
						<p className="fp">{fingerprint}</p>
						<button
							className="select"
							type="button"
							onClick={() => void onConfirm()}
							disabled={busy}
						>
							{busy ? "Working…" : "Numbers match"}
						</button>
					</div>
				) : (
					<p className="hint" role="status">
						Waiting for the other device. Camera or the code both work.
					</p>
				)}
				<Status value={status} />
			</Panel>
		</main>
	);
}
