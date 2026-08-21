"use client";

import { decrypt, encrypt } from "@meownow/crypto";
import { TEXT_TTL_MS } from "@meownow/protocol";
import { useCallback, useEffect, useState } from "react";
import { errorCode, getJson, postJson } from "@/lib/client/http";
import { loadVault } from "@/lib/vault/idb";
import { b64urlToBytes, bytesToB64url } from "@/lib/vault/wire";

type Me = {
	id: string;
	handle: string;
	displayName: string;
	role: "admin" | "member";
	canUpload: boolean;
	hasVault: boolean;
};

type ItemRow = {
	id: string;
	kind: "text" | "link";
	ciphertext: string;
	iv: string;
	createdAt: string;
};

export default function Page() {
	const [me, setMe] = useState<Me | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [hasLocal, setHasLocal] = useState(false);
	const [draft, setDraft] = useState("");
	const [items, setItems] = useState<Array<{ id: string; text: string }>>([]);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		void (async () => {
			const local = await loadVault();
			setHasLocal(local !== null);
			const res = await getJson("/api/auth/me");
			if (res.ok) {
				setMe(res.data as Me);
			}
			setLoaded(true);
		})();
	}, []);

	const refreshItems = useCallback(async () => {
		const stored = await loadVault();
		if (!stored) {
			return;
		}
		const res = await getJson("/api/items");
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		const list = (res.data as { items: ItemRow[] }).items;
		const opened: Array<{ id: string; text: string }> = [];
		for (const item of list) {
			try {
				const plain = await decrypt(
					stored.vaultKey,
					{ iv: b64urlToBytes(item.iv), bytes: b64urlToBytes(item.ciphertext) },
					{ itemId: item.id, kind: item.kind },
				);
				opened.push({ id: item.id, text: new TextDecoder().decode(plain) });
			} catch {
				opened.push({ id: item.id, text: "(undecryptable)" });
			}
		}
		setItems(opened);
	}, []);

	useEffect(() => {
		if (!me || !hasLocal) {
			return;
		}
		void refreshItems();
	}, [me, hasLocal, refreshItems]);

	async function onSend() {
		const stored = await loadVault();
		if (!stored || !draft.trim()) {
			return;
		}
		const id = crypto.randomUUID();
		const kind = draft.includes("://") ? ("link" as const) : ("text" as const);
		const sealed = await encrypt(stored.vaultKey, new TextEncoder().encode(draft), {
			itemId: id,
			kind,
		});
		const meta = await encrypt(stored.vaultKey, new TextEncoder().encode("{}"), {
			itemId: id,
			kind,
		});
		const res = await postJson("/api/items", {
			id,
			kind,
			ciphertext: bytesToB64url(sealed.bytes),
			metaCiphertext: bytesToB64url(meta.bytes),
			iv: bytesToB64url(sealed.iv),
			byteSize: sealed.bytes.byteLength,
			expiresAt: new Date(Date.now() + TEXT_TTL_MS).toISOString(),
		});
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		setDraft("");
		await refreshItems();
	}

	async function onLogout() {
		await postJson("/api/auth/logout", {});
		window.location.reload();
	}

	async function onCopy(text: string) {
		await navigator.clipboard.writeText(text);
	}

	return (
		<main>
			<h1 className="mono">meownow</h1>
			{!loaded ? <p>…</p> : null}
			{loaded && me ? (
				<>
					<p>
						Signed in as <span className="mono">{me.handle}</span>
					</p>
					<nav>
						{me.role === "admin" ? <a href="/invites">Invites</a> : null}
						{hasLocal ? <a href="/pair/scan">Scan device</a> : null}
						<a href="/pair">Add this device</a>
						<a href="/recover">Recover</a>
						{!me.hasVault ? <a href="/setup">Create vault</a> : null}
						<button type="button" onClick={() => void onLogout()}>
							Logout
						</button>
					</nav>
					{hasLocal ? (
						<>
							<label>
								Clipboard
								<textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} />
							</label>
							<button type="button" onClick={() => void onSend()}>
								Send
							</button>
							<ul>
								{items.map((item) => (
									<li key={item.id}>
										<button type="button" className="mono" onClick={() => void onCopy(item.text)}>
											{item.text}
										</button>
									</li>
								))}
							</ul>
						</>
					) : (
						<p>
							No vault on this browser. <a href="/pair">Pair</a> or <a href="/recover">recover</a>
							{!me.hasVault ? (
								<>
									{" "}
									or <a href="/setup">create</a>
								</>
							) : null}
							.
						</p>
					)}
				</>
			) : null}
			{loaded && !me ? (
				<nav>
					<a href="/login">Login</a>
					<a href="/join">Join</a>
					<a href="/enroll">Admin enroll</a>
					<a href="/recover">Recover</a>
				</nav>
			) : null}
			{status ? <p className="status mono">{status}</p> : null}
		</main>
	);
}
