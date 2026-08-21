"use client";

import { decrypt, encrypt } from "@meownow/crypto";
import { BLOB_TTL_MS, TEXT_PLAIN_MAX_BYTES, TEXT_TTL_MS } from "@meownow/protocol";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteJson, errorCode, getJson, postJson } from "@/lib/client/http";
import { Mesh } from "@/lib/p2p/mesh";
import { sendOnMesh, shouldPersist } from "@/lib/p2p/send";
import { takeIncomingShare } from "@/lib/pwa/inbox";
import { registerPush } from "@/lib/pwa/register-push";
import { Landing } from "@/lib/ui/landing";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";
import { formatGutterTime, ttlRemain, ttlWarn } from "@/lib/ui/time";
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
	createdAt: string;
	expiresAt: string;
	kind: ItemRow["kind"];
	blobId?: string;
	metaCiphertext?: string;
	iv?: string;
	wrappedKey?: { iv: string; bytes: string };
};

function itemTtl(kind: Shown["kind"]): number {
	return kind === "image" || kind === "file" ? BLOB_TTL_MS : TEXT_TTL_MS;
}

export default function Page() {
	const [me, setMe] = useState<Me | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [hasLocal, setHasLocal] = useState(false);
	const [draft, setDraft] = useState("");
	const [items, setItems] = useState<Shown[]>([]);
	const [status, setStatus] = useState<string | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const [local, setLocal] = useState(false);
	const [ephemeral, setEphemeral] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const meshRef = useRef<Mesh | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const itemsRef = useRef<Shown[]>([]);
	const reduceMotion = useReducedMotion();
	itemsRef.current = items;

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
			createdAt: item.createdAt,
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
		const session = connectHub((envelope) => {
			if (envelope.type === "hello") {
				meshRef.current?.close();
				meshRef.current = new Mesh(
					envelope.deviceId,
					(msg) => session.send(msg),
					(dc) => {
						void openItem({
							id: dc.item.id,
							kind: dc.item.kind,
							ciphertext: dc.item.ciphertext,
							metaCiphertext: dc.item.metaCiphertext,
							iv: dc.item.iv,
							wrappedKey: dc.item.wrappedKey,
							createdAt: new Date().toISOString(),
							expiresAt: dc.item.expiresAt,
						}).then((shown) => {
							setItems((current) =>
								current.some((row) => row.id === shown.id) ? current : [shown, ...current],
							);
						});
					},
					setLocal,
				);
			}
			if (envelope.type === "presence.changed") {
				meshRef.current?.handlePresence(envelope.devices);
			}
			if (
				envelope.type === "rtc.offer" ||
				envelope.type === "rtc.answer" ||
				envelope.type === "rtc.ice"
			) {
				void meshRef.current?.handleSignal(envelope);
			}
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
		return () => {
			session.close();
			meshRef.current?.close();
			meshRef.current = null;
			setLocal(false);
		};
	}, [me, hasLocal, openItem]);

	const sendPlain = useCallback(
		async (plain: string) => {
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
			const payload = {
				id,
				kind,
				ciphertext: bytesToB64url(sealed.bytes),
				metaCiphertext: bytesToB64url(meta.bytes),
				iv: bytesToB64url(sealed.iv),
				byteSize: sealed.bytes.byteLength,
				expiresAt,
			};
			const meshSend = await sendOnMesh(meshRef.current?.links() ?? [], {
				v: 1,
				type: "item",
				ephemeral,
				item: payload,
			});
			if (shouldPersist(ephemeral)) {
				const res = await postJson("/api/items", payload);
				if (!res.ok) {
					setStatus(errorCode(res.data));
					return;
				}
			} else if (meshSend.delivered === 0) {
				setStatus("No Local peer.");
				return;
			}
			setDraft("");
			const createdAt = new Date().toISOString();
			setItems((current) => [
				{ id, text: trimmed, createdAt, expiresAt, kind },
				...current.filter((row) => row.id !== id),
			]);
			setSelectedId(id);
		},
		[ephemeral],
	);

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

	const onCopy = useCallback(async (text: string) => {
		await navigator.clipboard.writeText(text);
		setStatus("Copied.");
	}, []);

	const onForget = useCallback(async (id: string) => {
		const res = await deleteJson(`/api/items/${id}`);
		if (!res.ok) {
			setStatus(errorCode(res.data));
			return;
		}
		setItems((current) => current.filter((row) => row.id !== id));
		setSelectedId((current) => (current === id ? null : current));
	}, []);

	const activateItem = useCallback(
		(item: Shown) => {
			setSelectedId(item.id);
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
		},
		[onCopy],
	);

	useEffect(() => {
		if (!me || !hasLocal) {
			return;
		}
		function onKey(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				target.closest("textarea, input, [contenteditable], .palette-layer")
			) {
				return;
			}
			const list = itemsRef.current;
			if (list.length === 0) {
				return;
			}
			const index = list.findIndex((row) => row.id === selectedId);
			if (event.key === "j" || event.key === "ArrowDown") {
				event.preventDefault();
				const next = list[Math.min(list.length - 1, (index < 0 ? -1 : index) + 1)];
				if (next) {
					setSelectedId(next.id);
				}
				return;
			}
			if (event.key === "k" || event.key === "ArrowUp") {
				event.preventDefault();
				const next = list[index <= 0 ? 0 : index - 1];
				if (next) {
					setSelectedId(next.id);
				}
				return;
			}
			const selected = list.find((row) => row.id === selectedId) ?? list[0];
			if (!selected) {
				return;
			}
			if (event.key === "Enter") {
				event.preventDefault();
				activateItem(selected);
				return;
			}
			if (event.key === "Backspace" || event.key === "Delete") {
				event.preventDefault();
				void onForget(selected.id);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [activateItem, hasLocal, me, onForget, selectedId]);

	async function onSend() {
		await sendPlain(draft);
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
		const createdAt = new Date().toISOString();
		setItems((current) => [
			{ ...result, createdAt },
			...current.filter((row) => row.id !== result.id),
		]);
		setSelectedId(result.id);
	}

	if (!loaded) {
		return (
			<main>
				<h1 className="file-hidden">Clipboard</h1>
			</main>
		);
	}

	if (!me) {
		return <Landing />;
	}

	if (!me.hasVault) {
		return (
			<main>
				<Panel>
					<h1>Vault</h1>
					<p className="lead">
						Create the vault on this device. Write the 12 words down. They are shown once.
					</p>
					<nav className="stack">
						<a className="select" href="/setup">
							Create vault
						</a>
					</nav>
					<Status value={status} />
				</Panel>
			</main>
		);
	}

	if (!hasLocal) {
		return (
			<main>
				<Panel>
					<h1>This device</h1>
					<p className="lead">
						No key in this browser. Pair it from a device that already works, or recover with the 12
						words.
					</p>
					<nav className="stack">
						<a className="select" href="/pair">
							Pair this device
						</a>
						<a href="/recover">Recover with phrase</a>
					</nav>
					<Status value={status} />
				</Panel>
			</main>
		);
	}

	return (
		<main>
			<h1 className="file-hidden">Clipboard</h1>
			<Panel>
				<div className="log-item is-compose">
					<span className="gutter mono">{formatGutterTime(new Date(now).toISOString(), now)}</span>
					<textarea
						aria-label="Buffer"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
								event.preventDefault();
								void onSend();
							}
						}}
						rows={3}
					/>
					<div className="composer-bar">
						<button className="select" type="button" onClick={() => void onSend()}>
							Send
						</button>
						<button
							type="button"
							className={ephemeral ? "is-on" : undefined}
							aria-pressed={ephemeral}
							onClick={() => setEphemeral((on) => !on)}
						>
							Ephemeral
						</button>
						{me.canUpload ? (
							<>
								<input
									ref={fileRef}
									className="file-hidden"
									type="file"
									onChange={(event) => {
										void onFile(event.target.files);
										event.target.value = "";
									}}
								/>
								<button type="button" onClick={() => fileRef.current?.click()}>
									File
								</button>
							</>
						) : null}
						{local ? <span className="mode mono">Local</span> : null}
					</div>
				</div>
				{items.length === 0 ? <p className="empty">Nothing on the clipboard.</p> : null}
				{items.length > 0 ? (
					<ul className="log">
						<AnimatePresence initial={false}>
							{items.map((item) => {
								const remain = ttlRemain(item.expiresAt, itemTtl(item.kind), now);
								const warn = ttlWarn(item.expiresAt, now);
								const selected = item.id === selectedId;
								return (
									<motion.li
										key={item.id}
										layout={!reduceMotion}
										initial={reduceMotion ? false : { opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
										transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
										className={["log-item", selected ? "is-selected" : ""]
											.filter(Boolean)
											.join(" ")}
									>
										<span className="gutter mono">{formatGutterTime(item.createdAt, now)}</span>
										<button type="button" className="body mono" onClick={() => activateItem(item)}>
											{item.text}
										</button>
										<button type="button" className="forget" onClick={() => void onForget(item.id)}>
											Forget
										</button>
										<span
											className={warn ? "ttl warn" : "ttl"}
											style={{ ["--remain" as string]: String(remain) }}
										/>
									</motion.li>
								);
							})}
						</AnimatePresence>
					</ul>
				) : null}
				<Status value={status} />
			</Panel>
		</main>
	);
}
