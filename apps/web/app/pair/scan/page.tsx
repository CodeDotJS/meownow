"use client";

import { unwrapExtractableForPairing, wrapVaultForPairing } from "@meownow/crypto";
import { asPublicJwk, pairingQrSchema } from "@meownow/protocol";
import { type FormEvent, useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";
import { loadVault } from "@/lib/vault/idb";
import { wrapToWire } from "@/lib/vault/wire";

export default function PairScanPage() {
	const [raw, setRaw] = useState("");
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

	async function onPrepare(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setStatus(null);
		try {
			const parsed = pairingQrSchema.safeParse(JSON.parse(raw) as unknown);
			if (!parsed.success) {
				setStatus("invalid_body");
				return;
			}
			const stored = await loadVault();
			if (!stored) {
				setStatus("vault_missing");
				return;
			}
			const extractable = await unwrapExtractableForPairing(
				stored.deviceKey,
				stored.wrappedExtractable,
			);
			const wrap = await wrapVaultForPairing(extractable, parsed.data.publicJwk);
			setFingerprint(wrap.fingerprint);
			setPending({
				id: parsed.data.id,
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
			<h1>Scan new device</h1>
			{fingerprint ? (
				<>
					<p>
						Fingerprint <span className="mono">{fingerprint}</span>
					</p>
					<button type="button" onClick={() => void onConfirm()} disabled={busy}>
						Numbers match
					</button>
				</>
			) : (
				<form onSubmit={(event) => void onPrepare(event)}>
					<label>
						QR payload
						<textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={8} />
					</label>
					<button type="submit" disabled={busy}>
						Compute fingerprint
					</button>
				</form>
			)}
			{status ? <p className="status mono">{status}</p> : null}
		</main>
	);
}
