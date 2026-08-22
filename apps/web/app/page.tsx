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
import { CreateVaultFlow } from "@/lib/ui/create-vault";
import { Landing } from "@/lib/ui/landing";
import { Panel } from "@/lib/ui/panel";
import { Status } from "@/lib/ui/status";
import { formatGutterTime, isLiveItem, ttlRemain, ttlWarn } from "@/lib/ui/time";
import { loadVault } from "@/lib/vault/idb";
import { connectHub } from "@/lib/vault/live";
import { dropStaleLocalVault } from "@/lib/vault/local";
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
	byteSize?: number;
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
	/** Kept so Undo can restore the exact row rather than re-encrypting. */
	ciphertext?: string;
	byteSize?: number;
	/** Never persisted server-side, so a refresh must not treat its absence as a delete. */
	ephemeral?: boolean;
};

/** Blob ciphertext lives in R2 and is not held here, so only text can come back. */
function restorable(item: Shown): boolean {
	return (
		(item.kind === "text" || item.kind === "link") &&
		Boolean(item.ciphertext && item.metaCiphertext && item.iv) &&
		typeof item.byteSize === "number"
	);
}

function itemTtl(kind: Shown["kind"]): number {
	return kind === "image" || kind === "file" ? BLOB_TTL_MS : TEXT_TTL_MS;
}

const UNREADABLE = "This browser cannot read that line";
const CLIP_HINT_KEY = "meownow.clip-hint";
const FORGET_TOMBSTONE_MS = 15000;

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
	const [hint, setHint] = useState(false);
	const [live, setLive] = useState(false);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [undo, setUndo] = useState<Shown | null>(null);
	const meshRef = useRef<Mesh | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const itemsRef = useRef<Shown[]>([]);
	/** id -> when the tombstone lapses. Stops an in-flight GET restoring a deleted row. */
	const tombstonesRef = useRef<Map<string, number>>(new Map());
	const reduceMotion = useReducedMotion();
	itemsRef.current = items;

	useEffect(() => {
		void (async () => {
			const res = await getJson("/api/auth/me");
			if (res.ok) {
				const profile = res.data as Me;
				await dropStaleLocalVault(profile.hasVault);
				setMe(profile);
			}
			const local = await loadVault();
			setHasLocal(local !== null);
			setLoaded(true);
		})();
	}, []);

	const finishVault = useCallback(() => {
		setMe((current) => (current ? { ...current, hasVault: true } : current));
		setHasLocal(true);
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
			ciphertext: item.ciphertext,
			byteSize: item.byteSize,
		};
		if (!stored) {
			return { ...base, text: UNREADABLE };
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
				return { ...base, text: UNREADABLE };
			}
			const plain = await decrypt(
				stored.vaultKey,
				{ iv: b64urlToBytes(item.iv), bytes: b64urlToBytes(item.ciphertext) },
				{ itemId: item.id, kind: item.kind },
			);
			return { ...base, text: new TextDecoder().decode(plain) };
		} catch {
			return { ...base, text: UNREADABLE };
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
			if (isLiveItem(item.expiresAt)) {
				opened.push(await openItem(item));
			}
		}
		const now = Date.now();
		const tombstones = tombstonesRef.current;
		for (const [id, lapses] of tombstones) {
			if (lapses <= now) {
				tombstones.delete(id);
			}
		}
		setItems((current) => {
			const merged = [...current.filter((row) => row.ephemeral), ...opened];
			const seen = new Set<string>();
			return merged
				.filter((row) => {
					if (seen.has(row.id) || tombstones.has(row.id)) {
						return false;
					}
					seen.add(row.id);
					return true;
				})
				.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
		});
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
				void refreshItems();
				meshRef.current?.close();
				meshRef.current = new Mesh(
					envelope.deviceId,
					(msg) => session.send(msg),
					(dc) => {
						if (dc.type === "item.deleted") {
							setItems((current) => current.filter((row) => row.id !== dc.id));
							setSelectedId((current) => (current === dc.id ? null : current));
							return;
						}
						void openItem({
							id: dc.item.id,
							kind: dc.item.kind,
							ciphertext: dc.item.ciphertext,
							metaCiphertext: dc.item.metaCiphertext,
							iv: dc.item.iv,
							wrappedKey: dc.item.wrappedKey,
							byteSize: dc.item.byteSize,
							createdAt: new Date().toISOString(),
							expiresAt: dc.item.expiresAt,
						}).then((shown) => {
							const row = dc.ephemeral ? { ...shown, ephemeral: true } : shown;
							setItems((current) =>
								current.some((entry) => entry.id === row.id) ? current : [row, ...current],
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
		}, setLive);
		function onWake() {
			if (document.visibilityState === "visible") {
				void refreshItems();
			}
		}
		document.addEventListener("visibilitychange", onWake);
		window.addEventListener("online", onWake);
		return () => {
			session.close();
			meshRef.current?.close();
			meshRef.current = null;
			setLive(false);
			setLocal(false);
			document.removeEventListener("visibilitychange", onWake);
			window.removeEventListener("online", onWake);
		};
	}, [me, hasLocal, openItem, refreshItems]);

	// Only while the socket is down, so a healthy session costs no extra requests.
	useEffect(() => {
		if (!me || !hasLocal || live) {
			return;
		}
		const id = window.setInterval(() => {
			if (document.visibilityState === "visible") {
				void refreshItems();
			}
		}, 15000);
		return () => window.clearInterval(id);
	}, [me, hasLocal, live, refreshItems]);

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
				{
					id,
					text: trimmed,
					createdAt,
					expiresAt,
					kind,
					ephemeral,
					ciphertext: payload.ciphertext,
					metaCiphertext: payload.metaCiphertext,
					iv: payload.iv,
					byteSize: payload.byteSize,
				},
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

	const dismissHint = useCallback(() => {
		sessionStorage.setItem(CLIP_HINT_KEY, "1");
		setHint(false);
	}, []);

	useEffect(() => {
		setHint(sessionStorage.getItem(CLIP_HINT_KEY) !== "1");
	}, []);

	const onCopy = useCallback(
		async (text: string, id?: string) => {
			dismissHint();
			try {
				await navigator.clipboard.writeText(text);
				setCopiedId(id ?? null);
				setStatus("Copied.");
			} catch {
				setCopiedId(null);
				setStatus("copy_failed");
			}
		},
		[dismissHint],
	);

	const commitForget = useCallback(async (item: Shown) => {
		// Peers hold their own copy. An ephemeral item exists nowhere else, so the
		// mesh is the only way to revoke it; for a stored item this just beats the
		// hub's fan-out and still works when the socket is down.
		await sendOnMesh(meshRef.current?.links() ?? [], {
			v: 1,
			type: "item.deleted",
			id: item.id,
		});
		if (item.ephemeral) {
			return;
		}
		const res = await deleteJson(`/api/items/${item.id}`);
		if (!res.ok) {
			setStatus(errorCode(res.data));
		}
	}, []);

	const onForget = useCallback(
		async (id: string) => {
			const item = itemsRef.current.find((row) => row.id === id);
			if (!item) {
				return;
			}
			setItems((current) => current.filter((row) => row.id !== id));
			setSelectedId((current) => (current === id ? null : current));
			setUndo(restorable(item) ? item : null);
			tombstonesRef.current.set(id, Date.now() + FORGET_TOMBSTONE_MS);
			// Forget is not deferred: every other device should drop it now, not
			// after an undo window that only this device knows about.
			await commitForget(item);
		},
		[commitForget],
	);

	const onUndoForget = useCallback(async () => {
		const item = undo;
		if (!item?.ciphertext || !item.metaCiphertext || !item.iv || item.byteSize === undefined) {
			return;
		}
		setUndo(null);
		tombstonesRef.current.delete(item.id);
		const payload = {
			id: item.id,
			kind: item.kind === "link" ? ("link" as const) : ("text" as const),
			ciphertext: item.ciphertext,
			metaCiphertext: item.metaCiphertext,
			iv: item.iv,
			byteSize: item.byteSize,
			expiresAt: item.expiresAt,
		};
		if (item.ephemeral) {
			const back = await sendOnMesh(meshRef.current?.links() ?? [], {
				v: 1,
				type: "item",
				ephemeral: true,
				item: payload,
			});
			if (back.delivered === 0) {
				setStatus("No Local peer.");
			}
		} else {
			const res = await postJson("/api/items", payload);
			if (!res.ok) {
				setStatus(errorCode(res.data));
				return;
			}
		}
		setItems((current) =>
			current.some((row) => row.id === item.id) ? current : [item, ...current],
		);
	}, [undo]);

	const activateItem = useCallback(
		(item: Shown) => {
			setSelectedId(item.id);
			if (item.text === UNREADABLE) {
				return;
			}
			dismissHint();
			if (item.kind === "image" || item.kind === "file") {
				if (item.blobId && item.wrappedKey && item.iv && item.metaCiphertext) {
					void downloadBlobItem({
						id: item.id,
						kind: item.kind,
						blobId: item.blobId,
						iv: item.iv,
						metaCiphertext: item.metaCiphertext,
						wrappedKey: item.wrappedKey,
					}).then((ok) => {
						setStatus(ok ? "Downloaded." : "download_failed");
					});
					return;
				}
				setStatus("download_failed");
				return;
			}
			void onCopy(item.text, item.id);
		},
		[dismissHint, onCopy],
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
		dismissHint();
		await sendPlain(draft);
	}

	async function onFile(files: FileList | null) {
		const file = files?.[0];
		if (!file) {
			return;
		}
		dismissHint();
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

	const draftLines = draft.split("\n").length;
	const visible = items.filter((item) => isLiveItem(item.expiresAt, now));

	if (!loaded) {
		return (
			<main>
				<h1 className="file-hidden">Clipboard</h1>
				<p className="file-hidden" role="status">
					Loading
				</p>
				<div className="panel sheet-skeleton" aria-hidden="true">
					<span className="skel" />
					<span className="skel" />
					<span className="skel skel-short" />
				</div>
			</main>
		);
	}

	if (!me) {
		return <Landing />;
	}

	if (!me.hasVault) {
		return (
			<main>
				<CreateVaultFlow onComplete={finishVault} />
			</main>
		);
	}

	if (!hasLocal) {
		return (
			<main>
				<Panel>
					<h1>This browser is new</h1>
					<p className="lead">Keep this screen open after you show a code.</p>
					<ol className="steps">
						<li>This browser shows a code.</li>
						<li>On the computer that already works, tap Add a device and type it.</li>
						<li>If the numbers match, continue here.</li>
					</ol>
					<nav className="stack">
						<a className="select" href="/pair/show">
							Show a code
						</a>
					</nav>
					<p className="hint">
						Lost every device? <a href="/recover">Use the 12 words</a>
					</p>
					<Status value={status} />
				</Panel>
			</main>
		);
	}

	return (
		<main className="clipboard">
			<h1 className="file-hidden">Clipboard</h1>
			<p className="clip-meta">
				<span>
					{visible.length === 1 ? "1 note" : `${visible.length} notes`}
					{ephemeral ? " · this Wi‑Fi only" : ""}
				</span>
				<span className={live ? "clip-live is-on" : "clip-live"}>
					{live ? "Live on your devices" : "Syncing…"}
				</span>
			</p>
			{hint ? (
				<p className="hint clip-hint">Tap a line to copy. Paste on this page to send.</p>
			) : null}
			<div className="stage">
				<div className="composer">
					<p className="sheet-label">{ephemeral ? "This Wi‑Fi only" : "New paste"}</p>
					<textarea
						aria-label={ephemeral ? "This Wi‑Fi only" : "New paste"}
						value={draft}
						placeholder="Type or paste"
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
								event.preventDefault();
								void onSend();
							}
						}}
						rows={4}
					/>
					{draftLines > 8 ? (
						<p className="field-hint">{draftLines} lines. The box stays this size.</p>
					) : null}
					<div className="composer-bar">
						<button className="select" type="button" onClick={() => void onSend()}>
							Send
						</button>
						<button
							type="button"
							className={ephemeral ? "composer-quiet is-on" : "composer-quiet"}
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
								<button
									type="button"
									className="composer-quiet"
									onClick={() => fileRef.current?.click()}
								>
									File
								</button>
							</>
						) : null}
						{local ? <span className="mode">Local</span> : null}
					</div>
					{ephemeral ? (
						<p className="field-hint">Skip the server. Needs another device on this Wi‑Fi.</p>
					) : null}
				</div>
				{visible.length === 0 ? (
					<p className="empty">
						<span>
							Nothing on the clipboard.
							<span className="empty-how">
								Type above, then Send. It will show on your other devices.
							</span>
						</span>
					</p>
				) : null}
				{visible.length > 0 ? (
					<ul className="log log-sheet">
						<li className="log-head">
							<p className="sheet-label">On the clipboard</p>
							<p className="clip-count">{visible.length}</p>
						</li>
						<AnimatePresence initial={false}>
							{visible.map((item) => {
								const remain = ttlRemain(item.expiresAt, itemTtl(item.kind), now);
								const warn = ttlWarn(item.expiresAt, now);
								const selected = item.id === selectedId;
								const locked = item.text === UNREADABLE;
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
										<span className="gutter">{formatGutterTime(item.createdAt, now)}</span>
										{locked ? (
											<p className="body">
												{item.text}. <a href="/pair/show">Show a code</a> or{" "}
												<a href="/recover">use the 12 words</a>
											</p>
										) : (
											<button type="button" className="body" onClick={() => activateItem(item)}>
												{item.text}
											</button>
										)}
										<span className="log-actions">
											{copiedId === item.id ? <span className="copied">Copied</span> : null}
											<button
												type="button"
												className="forget"
												onClick={() => void onForget(item.id)}
											>
												Forget
											</button>
										</span>
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
			</div>
			{undo ? (
				<p className="hint" role="status">
					Forgotten.{" "}
					<button type="button" onClick={() => void onUndoForget()}>
						Undo
					</button>
				</p>
			) : null}
			<Status value={status} />
		</main>
	);
}
