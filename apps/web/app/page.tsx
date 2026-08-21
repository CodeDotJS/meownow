"use client";

import { decrypt, encrypt } from "@meownow/crypto";
import { TEXT_PLAIN_MAX_BYTES, TEXT_TTL_MS } from "@meownow/protocol";
import { useCallback, useEffect, useState } from "react";
import { deleteJson, errorCode, getJson, postJson } from "@/lib/client/http";
import { takeIncomingShare } from "@/lib/pwa/inbox";
import { registerPush } from "@/lib/pwa/register-push";
import { loadVault } from "@/lib/vault/idb";
import { connectHub } from "@/lib/vault/live";
import { downloadBlobItem, sendBlobFile } from "@/lib/vault/upload-client";
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
	kind: "text" | "link" | "image" | "file";
	ciphertext?: string;
	metaCiphertext: string;
	iv: string;
	wrappedKey?: { iv: string; bytes: string };
	blobId?: string;
	createdAt: string;
	expiresAt: string;
};

type Shown = {
	id: string;
	text: string;
	expiresAt: string;
	kind: ItemRow["kind"];
	blobId?: string;
	metaCiphertext?: string;
	iv?: string;
	wrappedKey?: { iv: string; bytes: string };
};

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
		const base = {
			id: item.id,
			expiresAt: item.expiresAt,
			kind: item.kind,
			blobId: item.blobId,
			metaCiphertext: item.metaCiphertext,
			iv: item.iv,
			wrappedKey: item.wrappedKey,
		};
		if (!stored) {
			return { ...base, text: "(locked)" };
		}
		try {
			if ((item.kind === "image" || item.kind === "file") && item.metaCiphertext) {
				const plain = await decrypt(
					stored.vaultKey,
					{ iv: b64urlToBytes(item.iv), bytes: b64urlToBytes(item.metaCiphertext) },
					{ itemId: item.id, kind: item.kind },
				);
				const meta = JSON.parse(new TextDecoder().decode(plain)) as { filename?: string };
				return { ...base, text: meta.filename || item.kind };
			}
			if (!item.ciphertext) {
				return { ...base, text: "(undecryptable)" };
			}
			const plain = await decrypt(
				stored.vaultKey,
				{ iv: b64urlToBytes(item.iv), bytes: b64urlToBytes(item.ciphertext) },
				{ itemId: item.id, kind: item.kind },
			);
			return { ...base, text: new TextDecoder().decode(plain) };
		} catch {
			return { ...base, text: "(undecryptable)" };
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

	const sendPlain = useCallback(async (plain: string) => {
		const stored = await loadVault();
		const trimmed = plain.trim();
		if (!stored || !trimmed) {
			return;
		}
		const bytes = new TextEncoder().encode(trimmed);
		if (bytes.byteLength > TEXT_PLAIN_MAX_BYTES) {
			setStatus("item_invalid");
			return;
		}
		const id = crypto.randomUUID();
		const kind = /^https?:\/\//i.test(trimmed) ? ("link" as const) : ("text" as const);
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
			{ id, text: trimmed, expiresAt, kind },
			...current.filter((row) => row.id !== id),
		]);
	}, []);

	useEffect(() => {
		if (!me || !hasLocal) {
			return;
		}
		void takeIncomingShare().then((incoming) => {
			if (incoming) {
				void sendPlain(incoming.text);
			}
		});
	}, [me, hasLocal, sendPlain]);

	useEffect(() => {
		if (!me || !hasLocal) {
			return;
		}
		function onPaste(event: ClipboardEvent) {
			const target = event.target;
			if (target instanceof HTMLElement && target.closest("textarea, input, [contenteditable]")) {
				return;
			}
			const text = event.clipboardData?.getData("text/plain");
			if (!text?.trim()) {
				return;
			}
			event.preventDefault();
			void sendPlain(text);
		}
		document.addEventListener("paste", onPaste);
		return () => document.removeEventListener("paste", onPaste);
	}, [me, hasLocal, sendPlain]);

	useEffect(() => {
		if (!me || !hasLocal) {
			return;
		}
		void registerPush();
	}, [me, hasLocal]);

	async function onSend() {
		await sendPlain(draft);
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

	async function onFile(files: FileList | null) {
		const file = files?.[0];
		if (!file) {
			return;
		}
		const result = await sendBlobFile(file);
		if ("error" in result) {
			setStatus(result.error);
			return;
		}
		setItems((current) => [{ ...result }, ...current.filter((row) => row.id !== result.id)]);
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
						{me.role === "admin" ? <a href="/requests">Requests</a> : null}
						{!me.canUpload ? <a href="/access">Upload access</a> : null}
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
							{me.canUpload ? (
								<label>
									File
									<input
										type="file"
										onChange={(event) => {
											void onFile(event.target.files);
											event.target.value = "";
										}}
									/>
								</label>
							) : null}
							{items.length === 0 ? <p className="empty">Nothing on the clipboard.</p> : null}
							<ul>
								{items.map((item) => {
									const remain = Math.max(
										0,
										Math.min(1, (Date.parse(item.expiresAt) - now) / TEXT_TTL_MS),
									);
									return (
										<li key={item.id}>
											<button
												type="button"
												className="mono"
												onClick={() => {
													if (item.kind === "image" || item.kind === "file") {
														if (item.blobId && item.wrappedKey && item.iv && item.metaCiphertext) {
															void downloadBlobItem({
																id: item.id,
																kind: item.kind,
																blobId: item.blobId,
																iv: item.iv,
																metaCiphertext: item.metaCiphertext,
																wrappedKey: item.wrappedKey,
															});
														}
														return;
													}
													void onCopy(item.text);
												}}
											>
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
