"use client";

import { decrypt, encrypt } from "@meownow/crypto";
import { TEXT_PLAIN_MAX_BYTES, TEXT_TTL_MS } from "@meownow/protocol";
import { useCallback, useEffect, useState } from "react";
import { deleteJson, errorCode, getJson, postJson } from "@/lib/client/http";
import { loadVault } from "@/lib/vault/idb";
import { connectHub } from "@/lib/vault/live";
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
	expiresAt: string;
};

type Shown = { id: string; text: string; expiresAt: string };

export default function Page() {
	const [me, setMe] = useState<Me | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [hasLocal, setHasLocal] = useState(false);
	const [draft, setDraft] = useState("");
	const [items, setItems] = useState<Shown[]>([]);
	const [status, setStatus] = useState<string | null>(null);
	const [now, setNow] = useState(() => Date.now());

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

	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, []);

	const openItem = useCallback(async (item: ItemRow): Promise<Shown> => {
		const stored = await loadVault();
		if (!stored) {
			return { id: item.id, text: "(locked)", expiresAt: item.expiresAt };
		}
		try {
			const plain = await decrypt(
				stored.vaultKey,
				{ iv: b64urlToBytes(item.iv), bytes: b64urlToBytes(item.ciphertext) },
				{ itemId: item.id, kind: item.kind },
			);
			return { id: item.id, text: new TextDecoder().decode(plain), expiresAt: item.expiresAt };
		} catch {
			return { id: item.id, text: "(undecryptable)", expiresAt: item.expiresAt };
		}
	}, []);

	const refreshItems = useCallback(async () => {
		const res = await getJson("/api/items");
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		const list = (res.data as { items: ItemRow[] }).items;
		const opened: Shown[] = [];
		for (const item of list) {
			opened.push(await openItem(item));
		}
		setItems(opened);
	}, [openItem]);

	useEffect(() => {
		if (!me || !hasLocal) {
			return;
		}
		void refreshItems();
	}, [me, hasLocal, refreshItems]);

	useEffect(() => {
		if (!me || !hasLocal) {
			return;
		}
		return connectHub((envelope) => {
			if (envelope.type === "item.created") {
				void openItem(envelope.item).then((shown) => {
					setItems((current) =>
						current.some((row) => row.id === shown.id) ? current : [shown, ...current],
					);
				});
			}
			if (envelope.type === "item.deleted") {
				setItems((current) => current.filter((row) => row.id !== envelope.id));
			}
		});
	}, [me, hasLocal, openItem]);

	async function onSend() {
		const stored = await loadVault();
		if (!stored || !draft.trim()) {
			return;
		}
		const bytes = new TextEncoder().encode(draft);
		if (bytes.byteLength > TEXT_PLAIN_MAX_BYTES) {
			setStatus("item_invalid");
			return;
		}
		const id = crypto.randomUUID();
		const kind = draft.includes("://") ? ("link" as const) : ("text" as const);
		const sealed = await encrypt(stored.vaultKey, bytes, { itemId: id, kind });
		const meta = await encrypt(stored.vaultKey, new TextEncoder().encode("{}"), {
			itemId: id,
			kind,
		});
		const expiresAt = new Date(Date.now() + TEXT_TTL_MS).toISOString();
		const res = await postJson("/api/items", {
			id,
			kind,
			ciphertext: bytesToB64url(sealed.bytes),
			metaCiphertext: bytesToB64url(meta.bytes),
			iv: bytesToB64url(sealed.iv),
			byteSize: sealed.bytes.byteLength,
			expiresAt,
		});
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		setDraft("");
		setItems((current) => [
			{ id, text: draft, expiresAt },
			...current.filter((row) => row.id !== id),
		]);
	}

	async function onLogout() {
		await postJson("/api/auth/logout", {});
		window.location.reload();
	}

	async function onCopy(text: string) {
		await navigator.clipboard.writeText(text);
		setStatus("Copied.");
	}

	async function onForget(id: string) {
		const res = await deleteJson(`/api/items/${id}`);
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		setItems((current) => current.filter((row) => row.id !== id));
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
								<textarea
									value={draft}
									onChange={(e) => setDraft(e.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
											event.preventDefault();
											void onSend();
										}
									}}
									rows={4}
								/>
							</label>
							<button type="button" onClick={() => void onSend()}>
								Send
							</button>
							<ul>
								{items.map((item) => {
									const remain = Math.max(
										0,
										Math.min(1, (Date.parse(item.expiresAt) - now) / TEXT_TTL_MS),
									);
									return (
										<li key={item.id}>
											<button type="button" className="mono" onClick={() => void onCopy(item.text)}>
												{item.text}
											</button>
											<span className="ttl" style={{ ["--remain" as string]: String(remain) }} />
											<button type="button" onClick={() => void onForget(item.id)}>
												Forget
											</button>
										</li>
									);
								})}
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
