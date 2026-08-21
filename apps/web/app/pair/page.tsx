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
import { asPublicJwk, type PairingQr } from "@meownow/protocol";
import { startRegistration } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import { PairingQrCanvas } from "@/lib/pair/qr-canvas";
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

export default function PairPage() {
	const [payload, setPayload] = useState("");
	const [fingerprint, setFingerprint] = useState<string | null>(null);
	const [wrap, setWrap] = useState<WrapPayload | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void (async () => {
			const pair = await generatePairingKeyPair();
			const pub = await publicJwk(pair.publicKey);
			const res = await postJson("/api/pairing", { publicJwk: asPublicJwk(pub) });
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
			const started = res.data as { id: string };
			setPrivateKey(pair.privateKey);
			setSessionId(started.id);
			const qr: PairingQr = { v: 1, id: started.id, publicJwk: asPublicJwk(pub) };
			setPayload(JSON.stringify(qr));
		})();
	}, []);

	useEffect(() => {
		if (!sessionId || !privateKey || wrap) {
			return;
		}
		const timer = window.setInterval(() => {
			void (async () => {
				const res = await getJson(`/api/pairing/${sessionId}`);
				if (!res.ok) {
					return;
				}
				const data = res.data as { wrap: WrapPayload | null };
				if (!data.wrap) {
					return;
				}
				const fp = await fingerprintSharedSecret(privateKey, data.wrap.vaultWrap.ephPublicJwk);
				setFingerprint(fp);
				setWrap(data.wrap);
			})();
		}, 1500);
		return () => window.clearInterval(timer);
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
				<h1>New device</h1>
				<p className="lead">
					Keep this screen open. On a device that already works, tap Add device, then point that
					camera here.
				</p>
				<ol className="steps">
					<li>Leave this QR on screen.</li>
					<li>On the other device, tap Add device in the top bar.</li>
					<li>Point that camera at this QR.</li>
					<li>Match the numbers. Create a passkey here.</li>
				</ol>
				{payload ? <PairingQrCanvas payload={payload} /> : null}
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
					<p className="hint">Waiting for the other device.</p>
				)}
				<Status value={status} />
			</Panel>
		</main>
	);
}
