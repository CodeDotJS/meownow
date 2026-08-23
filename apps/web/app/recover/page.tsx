"use client";

import {
	generateIdentityKeyPair,
	generateVaultKey,
	publicJwk,
	recoverExtractableVault,
	recoveryVerifier,
	validateMnemonic,
	wrapExtractableForDevice,
	wrapIdentityKey,
} from "@meownow/crypto";
import { asPublicJwk } from "@meownow/protocol";
import { startRegistration } from "@simplewebauthn/browser";
import { type FormEvent, useState } from "react";
import { errorCode, postJson } from "@/lib/client/http";
import { rememberPasskey } from "@/lib/client/passkey";
import { Panel } from "@/lib/ui/panel";
import { AlreadyHere, SessionLoading, useBrowserSession } from "@/lib/ui/session";
import { Status } from "@/lib/ui/status";
import { saveVault } from "@/lib/vault/idb";
import { b64urlToBytes, bytesToB64url, wrapFromWire } from "@/lib/vault/wire";

export default function RecoverPage() {
	const { ready, me, hasLocal } = useBrowserSession();
	const [handle, setHandle] = useState("");
	const [phrase, setPhrase] = useState("");
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	if (!ready) {
		return (
			<main>
				<SessionLoading title="Recover" />
			</main>
		);
	}
	if (hasLocal) {
		return (
			<main>
				<AlreadyHere
					title="This browser already works"
					lead="Recovery is for a browser that has nothing. This one already has the clipboard."
					actionHref={me ? "/" : "/login"}
					action={me ? "Back to clipboard" : "Sign in"}
				/>
			</main>
		);
	}

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setStatus(null);
		try {
			const mnemonic = phrase.trim();
			if (!(await validateMnemonic(mnemonic))) {
				setStatus("recovery_invalid");
				return;
			}
			const rec = await postJson("/api/vault/recovery", { handle });
			if (!rec.ok) {
				setStatus(errorCode(rec.data));
				return;
			}
			const material = rec.data as {
				recoverySalt: string;
				wrappedVaultRecovery: { iv: string; bytes: string };
			};
			const salt = b64urlToBytes(material.recoverySalt);
			const extractable = await recoverExtractableVault({
				mnemonic,
				salt,
				wrapped: wrapFromWire(material.wrappedVaultRecovery),
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
			const identity = await generateIdentityKeyPair();
			const identityPub = asPublicJwk(await publicJwk(identity.publicKey));
			const wrappedIdentity = await wrapIdentityKey(vaultKey, identity.privateKey);
			await saveVault({
				userId: handle,
				vaultKey,
				deviceKey,
				wrappedExtractable,
				wrappedIdentity,
				identityPub,
			});
			const optionsRes = await postJson("/api/recovery/register/options", {
				handle,
				verifier: bytesToB64url(await recoveryVerifier(mnemonic, salt)),
				deviceLabel: "this device",
			});
			if (!optionsRes.ok) {
				setStatus(errorCode(optionsRes.data));
				return;
			}
			const payload = optionsRes.data as {
				options: Parameters<typeof startRegistration>[0]["optionsJSON"];
			};
			const credential = await startRegistration({ optionsJSON: payload.options });
			const verifyRes = await postJson("/api/recovery/register/verify", { credential });
			if (!verifyRes.ok) {
				setStatus(errorCode(verifyRes.data));
				return;
			}
			rememberPasskey(credential.rawId || credential.id);
			window.location.href = "/";
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "recover_failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main>
			<Panel>
				<h1>Recover</h1>
				<p className="lead">
					The 12 words unlock this clipboard on a new browser. Then create a passkey.
				</p>
				<form onSubmit={(event) => void onSubmit(event)}>
					<label>
						Username
						<input
							value={handle}
							onChange={(e) => setHandle(e.target.value)}
							autoComplete="username"
						/>
					</label>
					<label>
						Recovery phrase
						<textarea
							className="mono"
							value={phrase}
							onChange={(e) => setPhrase(e.target.value)}
							rows={3}
						/>
					</label>
					<button className="select" type="submit" disabled={busy}>
						Recover
					</button>
				</form>
				<Status value={status} />
			</Panel>
		</main>
	);
}
