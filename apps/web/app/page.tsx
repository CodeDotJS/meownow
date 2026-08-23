"use client";

import { decrypt, encrypt } from "@meownow/crypto";
import { BLOB_TTL_MS, TEXT_PLAIN_MAX_BYTES, TEXT_TTL_MS, type WsEnvelope } from "@meownow/protocol";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteJson, errorCode, getJson, postJson } from "@/lib/client/http";
import { ephemeralLivePath } from "@/lib/p2p/ephemeral";
import { Mesh } from "@/lib/p2p/mesh";
import { sendOnMesh, shouldPersist } from "@/lib/p2p/send";
import { takeIncomingShare } from "@/lib/pwa/inbox";
import { registerPush } from "@/lib/pwa/register-push";
import { ComposerGlyph } from "@/lib/ui/composer-glyph";
import { CreateVaultFlow } from "@/lib/ui/create-vault";
import { FilePreview, type FilePreviewState } from "@/lib/ui/file-preview";
import { HoverTip } from "@/lib/ui/hover-tip";
import { Landing } from "@/lib/ui/landing";
import { CatMark } from "@/lib/ui/marks";
import { mergeRemoteItems } from "@/lib/ui/merge-items";
import { NoteReader, type NoteReaderState } from "@/lib/ui/note-reader";
import { textNeedsReader } from "@/lib/ui/note-size";
import { Panel } from "@/lib/ui/panel";
import { PixelStamp, PixelThumb } from "@/lib/ui/pixel-avatar";
import { OFFLINE_POLL_MS, shouldHttpPoll } from "@/lib/ui/reconcile";
import { Status } from "@/lib/ui/status";
import { formatClockTime, groupByDay, isLiveItem, ttlRemain, ttlWarn } from "@/lib/ui/time";
import { hubSend, subscribeHub } from "@/lib/vault/hub-live";
import { loadVault } from "@/lib/vault/idb";
import { dropStaleLocalVault } from "@/lib/vault/local";
import { downloadBlobItem, openBlobPreview, sendBlobFile } from "@/lib/vault/upload-client";
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
	/** Object URL drawn in this browser only. */
	previewUrl?: string;
	uploadProgress?: number;
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
const UNDO_NOTICE_MS = 5000;

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
	const [sending, setSending] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [hint, setHint] = useState(false);
	const [live, setLive] = useState(false);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [undo, setUndo] = useState<Shown | null>(null);
	const [preview, setPreview] = useState<FilePreviewState | null>(null);
	const [note, setNote] = useState<NoteReaderState | null>(null);
	const meshRef = useRef<Mesh | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const itemsRef = useRef<Shown[]>([]);
	/** id -> when the tombstone lapses. Stops an in-flight GET restoring a deleted row. */
	const tombstonesRef = useRef<Map<string, number>>(new Map());
	/** Notes this browser wrote that a slower GET must not drop. */
	const pendingRef = useRef<Set<string>>(new Set());
	const refreshSeqRef = useRef(0);
	const forgetWaitRef = useRef(Promise.resolve(true));
	const sendingRef = useRef(false);
	const hubSendRef = useRef<(envelope: WsEnvelope) => boolean>(() => false);
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
		const seq = ++refreshSeqRef.current;
		const res = await getJson("/api/items");
		if (seq !== refreshSeqRef.current) {
			return;
		}
		if (!res.ok) {
			const failed = errorCode(res.data);
			if (failed === "vault_missing") {
				setStatus(failed);
			}
			return;
		}
		const list = (res.data as { items: ItemRow[] }).items;
		const opened: Shown[] = [];
		for (const item of list) {
			if (isLiveItem(item.expiresAt)) {
				opened.push(await openItem(item));
			}
		}
		if (seq !== refreshSeqRef.current) {
			return;
		}
		const now = Date.now();
		const tombstones = tombstonesRef.current;
		for (const [id, lapses] of tombstones) {
			if (lapses <= now) {
				tombstones.delete(id);
			}
		}
		for (const row of opened) {
			pendingRef.current.delete(row.id);
		}
		setItems((current) =>
			mergeRemoteItems(current, opened, {
				tombstones: tombstones.keys(),
				pending: pendingRef.current,
			}).map((row) => {
				const prev = current.find((item) => item.id === row.id);
				return prev?.previewUrl ? { ...row, previewUrl: prev.previewUrl } : row;
			}),
		);
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
		const stopHub = subscribeHub({
			onLive: setLive,
			onEnvelope: (envelope) => {
				if (envelope.type === "hello") {
					void refreshItems();
					meshRef.current?.close();
					meshRef.current = new Mesh(
						envelope.deviceId,
						(msg) => hubSend(msg),
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
						const row = envelope.ephemeral ? { ...shown, ephemeral: true } : shown;
						setItems((current) =>
							current.some((entry) => entry.id === row.id) ? current : [row, ...current],
						);
					});
				}
				if (envelope.type === "item.deleted") {
					setItems((current) => current.filter((row) => row.id !== envelope.id));
				}
			},
		});
		hubSendRef.current = hubSend;
		function onWake() {
			if (document.visibilityState === "visible") {
				void refreshItems();
			}
		}
		document.addEventListener("visibilitychange", onWake);
		window.addEventListener("online", onWake);
		return () => {
			stopHub();
			hubSendRef.current = () => false;
			meshRef.current?.close();
			meshRef.current = null;
			setLive(false);
			setLocal(false);
			document.removeEventListener("visibilitychange", onWake);
			window.removeEventListener("online", onWake);
		};
	}, [me, hasLocal, openItem, refreshItems]);

	const hadLive = useRef(false);
	useEffect(() => {
		if (!me || !hasLocal) {
			return;
		}
		if (live) {
			hadLive.current = true;
			return;
		}
		if (hadLive.current) {
			hadLive.current = false;
			void refreshItems();
		}
		if (!shouldHttpPoll({ live: false, visible: document.visibilityState === "visible" })) {
			return;
		}
		const id = window.setInterval(() => {
			if (shouldHttpPoll({ live: false, visible: document.visibilityState === "visible" })) {
				void refreshItems();
			}
		}, OFFLINE_POLL_MS);
		return () => window.clearInterval(id);
	}, [me, hasLocal, live, refreshItems]);

	const sendPlain = useCallback(
		async (plain: string) => {
			if (sendingRef.current) {
				return;
			}
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
			sendingRef.current = true;
			setSending(true);
			try {
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
				const createdAt = new Date().toISOString();
				const localItem: Shown = {
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
				};
				pendingRef.current.add(id);
				setStatus(null);
				setDraft("");
				setItems((current) => [localItem, ...current.filter((row) => row.id !== id)]);
				setSelectedId(id);
				const meshSend = await sendOnMesh(meshRef.current?.links() ?? [], {
					v: 1,
					type: "item",
					ephemeral,
					item: payload,
				});
				if (shouldPersist(ephemeral)) {
					const res = await postJson("/api/items", payload);
					if (!res.ok) {
						pendingRef.current.delete(id);
						setItems((current) => current.filter((row) => row.id !== id));
						setDraft(trimmed);
						setStatus(errorCode(res.data));
					}
					return;
				}
				const hubSent =
					meshSend.delivered === 0 &&
					hubSendRef.current({
						v: 1,
						type: "item.created",
						ephemeral: true,
						item: { ...payload, createdAt },
					});
				if (ephemeralLivePath({ meshDelivered: meshSend.delivered, hubSent }) === "none") {
					setStatus(meshSend.failed > 0 ? "dc_send_failed" : "No Local peer.");
				}
			} catch {
				setStatus("request_failed");
			} finally {
				sendingRef.current = false;
				setSending(false);
			}
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

	useEffect(() => {
		return () => {
			for (const row of itemsRef.current) {
				if (row.previewUrl) {
					URL.revokeObjectURL(row.previewUrl);
				}
			}
		};
	}, []);

	const onCopy = useCallback(
		async (text: string, id?: string) => {
			dismissHint();
			try {
				await navigator.clipboard.writeText(text);
				setCopiedId(id ?? null);
				setStatus(null);
			} catch {
				setCopiedId(null);
				setStatus("copy_failed");
			}
		},
		[dismissHint],
	);

	useEffect(() => {
		if (!copiedId) {
			return;
		}
		const timer = window.setTimeout(() => setCopiedId(null), 1600);
		return () => window.clearTimeout(timer);
	}, [copiedId]);

	useEffect(() => {
		if (status !== "Downloaded.") {
			return;
		}
		const timer = window.setTimeout(() => setStatus(null), 2000);
		return () => window.clearTimeout(timer);
	}, [status]);

	useEffect(() => {
		if (!undo) {
			return;
		}
		const timer = window.setTimeout(() => setUndo(null), UNDO_NOTICE_MS);
		return () => window.clearTimeout(timer);
	}, [undo]);

	const commitForget = useCallback(async (item: Shown): Promise<boolean> => {
		// Peers hold their own copy. An ephemeral item exists nowhere else, so the
		// mesh is the only way to revoke it; for a stored item this just beats the
		// hub's fan-out and still works when the socket is down.
		await sendOnMesh(meshRef.current?.links() ?? [], {
			v: 1,
			type: "item.deleted",
			id: item.id,
		});
		if (item.ephemeral) {
			return true;
		}
		const res = await deleteJson(`/api/items/${item.id}`);
		if (!res.ok) {
			const failed = errorCode(res.data);
			if (failed !== "item_invalid" && failed !== "not_found") {
				setStatus(failed);
				return false;
			}
		}
		return true;
	}, []);

	const onForget = useCallback(
		async (id: string) => {
			const item = itemsRef.current.find((row) => row.id === id);
			if (!item) {
				return;
			}
			if (item.previewUrl) {
				URL.revokeObjectURL(item.previewUrl);
			}
			if (preview?.url === item.previewUrl) {
				setPreview(null);
			}
			if (note?.id === id) {
				setNote(null);
			}
			setItems((current) => current.filter((row) => row.id !== id));
			setSelectedId((current) => (current === id ? null : current));
			setUndo(restorable(item) ? item : null);
			pendingRef.current.delete(id);
			tombstonesRef.current.set(id, Date.now() + FORGET_TOMBSTONE_MS);
			// Forget is not deferred: every other device should drop it now, not
			// after an undo window that only this device knows about.
			const wait = commitForget(item);
			forgetWaitRef.current = wait;
			await wait;
		},
		[commitForget, note, preview],
	);

	const onUndoForget = useCallback(async () => {
		const item = undo;
		if (!item?.ciphertext || !item.metaCiphertext || !item.iv || item.byteSize === undefined) {
			return;
		}
		setUndo(null);
		const removed = await forgetWaitRef.current;
		tombstonesRef.current.delete(item.id);
		if (!item.ephemeral && !removed) {
			setItems((current) =>
				current.some((row) => row.id === item.id) ? current : [item, ...current],
			);
			return;
		}
		pendingRef.current.add(item.id);
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

	const downloadNote = useCallback(async (item: Shown) => {
		if (item.kind === "text" || item.kind === "link") {
			const href = URL.createObjectURL(new Blob([item.text], { type: "text/plain;charset=utf-8" }));
			const link = document.createElement("a");
			link.href = href;
			link.download = item.kind === "link" ? "link.txt" : "note.txt";
			link.rel = "noopener";
			link.click();
			URL.revokeObjectURL(href);
			setStatus("Downloaded.");
			return;
		}
		if (item.previewUrl) {
			const link = document.createElement("a");
			link.href = item.previewUrl;
			link.download = item.text || "download";
			link.rel = "noopener";
			link.click();
			setStatus("Downloaded.");
			return;
		}
		if (item.blobId && item.wrappedKey && item.iv && item.metaCiphertext) {
			const ok = await downloadBlobItem({
				id: item.id,
				kind: item.kind === "image" ? "image" : "file",
				blobId: item.blobId,
				iv: item.iv,
				metaCiphertext: item.metaCiphertext,
				wrappedKey: item.wrappedKey,
			});
			setStatus(ok ? "Downloaded." : "download_failed");
			return;
		}
		setStatus("download_failed");
	}, []);

	const openPreview = useCallback(async (item: Shown) => {
		if (item.previewUrl) {
			setPreview({
				url: item.previewUrl,
				filename: item.text,
				kind: item.kind === "image" ? "image" : "file",
			});
			return;
		}
		if (!item.blobId || !item.wrappedKey || !item.iv || !item.metaCiphertext) {
			setStatus("download_failed");
			return;
		}
		const opened = await openBlobPreview({
			id: item.id,
			kind: item.kind === "image" ? "image" : "file",
			blobId: item.blobId,
			iv: item.iv,
			metaCiphertext: item.metaCiphertext,
			wrappedKey: item.wrappedKey,
		});
		if (!opened) {
			setStatus("download_failed");
			return;
		}
		const kind = opened.mime.startsWith("image/") ? ("image" as const) : ("file" as const);
		setItems((current) =>
			current.map((row) => (row.id === item.id ? { ...row, previewUrl: opened.url } : row)),
		);
		setPreview({ url: opened.url, filename: opened.filename, kind });
	}, []);

	const activateItem = useCallback(
		(item: Shown) => {
			setSelectedId(item.id);
			if (item.text === UNREADABLE) {
				return;
			}
			dismissHint();
			if (item.kind === "image" || item.kind === "file") {
				setNote(null);
				void openPreview(item);
				return;
			}
			setPreview(null);
			if (textNeedsReader(item.text)) {
				setNote({ id: item.id, text: item.text, createdAt: item.createdAt });
				return;
			}
			setNote(null);
			void onCopy(item.text, item.id);
		},
		[dismissHint, onCopy, openPreview],
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
				target.closest("textarea, input, [contenteditable], .palette-layer, .preview-layer")
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
		const id = crypto.randomUUID();
		const kind = file.type.startsWith("image/") ? ("image" as const) : ("file" as const);
		const previewUrl =
			kind === "image" && file.type !== "image/svg+xml" ? URL.createObjectURL(file) : undefined;
		const createdAt = new Date().toISOString();
		const expiresAt = new Date(Date.now() + BLOB_TTL_MS).toISOString();
		pendingRef.current.add(id);
		setStatus(null);
		setItems((current) => [
			{
				id,
				text: file.name,
				kind,
				previewUrl,
				uploadProgress: 0.04,
				createdAt,
				expiresAt,
			},
			...current.filter((row) => row.id !== id),
		]);
		setSelectedId(id);
		const result = await sendBlobFile(file, {
			id,
			onProgress: (fraction) => {
				setItems((current) =>
					current.map((row) => (row.id === id ? { ...row, uploadProgress: fraction } : row)),
				);
			},
		});
		if ("error" in result) {
			pendingRef.current.delete(id);
			setItems((current) => current.filter((row) => row.id !== id));
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
			setStatus(result.error);
			return;
		}
		if (!itemsRef.current.some((row) => row.id === id)) {
			pendingRef.current.delete(id);
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
			return;
		}
		pendingRef.current.delete(id);
		setItems((current) =>
			current.map((row) =>
				row.id === id
					? {
							...row,
							...result,
							previewUrl: row.previewUrl ?? previewUrl,
							uploadProgress: undefined,
						}
					: row,
			),
		);
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
		return <Landing hasLocal={hasLocal} />;
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
			{hint ? (
				<p className="hint clip-hint">
					Tap a short note to copy. Open a long one to read it. Paste on this page to send.
				</p>
			) : null}
			<div className={ephemeral ? "stage is-ghost" : "stage"}>
				<div className="composer">
					<p className="sheet-label">{ephemeral ? "Live only" : "New paste"}</p>
					<textarea
						aria-label={ephemeral ? "Live only" : "New paste"}
						value={draft}
						placeholder="Type or paste"
						enterKeyHint="enter"
						autoComplete="off"
						autoCorrect="on"
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(event) => {
							if (
								event.key === "Enter" &&
								(event.metaKey || event.ctrlKey) &&
								!event.nativeEvent.isComposing
							) {
								event.preventDefault();
								void onSend();
							}
						}}
						rows={4}
					/>
					<div className="composer-foot">
						{draftLines > 8 ? <p className="field-hint">{draftLines} lines</p> : null}
						<div className="composer-bar">
							<HoverTip label={sending ? "Sending" : "Send"} place="above">
								<button
									className="composer-icon"
									type="button"
									disabled={sending}
									aria-label={sending ? "Sending" : "Send"}
									onClick={() => void onSend()}
								>
									<ComposerGlyph name="send" />
								</button>
							</HoverTip>
							<HoverTip label="Ephemeral" place="above">
								<button
									type="button"
									className={ephemeral ? "composer-icon is-on" : "composer-icon"}
									aria-pressed={ephemeral}
									aria-label="Ephemeral"
									onClick={() => setEphemeral((on) => !on)}
								>
									<ComposerGlyph name="ephemeral" pop={ephemeral} />
								</button>
							</HoverTip>
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
									<HoverTip label="File" place="above">
										<button
											type="button"
											className="composer-icon"
											aria-label="File"
											onClick={() => fileRef.current?.click()}
										>
											<ComposerGlyph name="file" />
										</button>
									</HoverTip>
								</>
							) : null}
						</div>
						{ephemeral ? (
							<p className="field-hint is-center">
								Skip the store. Needs another device that is live.
							</p>
						) : null}
						<Status value={status} />
					</div>
				</div>
				<div className="tray">
					<div className="log-head">
						<p className="sheet-label">On the clipboard</p>
						<div className="log-head-meta">
							{local ? (
								<HoverTip label="Direct on this network" place="below">
									<button type="button" className="path-chip" aria-label="Direct on this network">
										LAN
									</button>
								</HoverTip>
							) : null}
							<p className="clip-count">
								<span className="clip-count-num">{visible.length}</span>
								<span className="clip-count-word">{visible.length === 1 ? "note" : "notes"}</span>
							</p>
						</div>
					</div>
					{undo || status ? (
						<div className="tray-notice">
							{undo ? (
								<p role="status">
									<span>Forgotten.</span>
									<button className="tray-undo" type="button" onClick={() => void onUndoForget()}>
										Undo
									</button>
								</p>
							) : null}
							<Status value={status} />
						</div>
					) : null}
					{visible.length === 0 ? (
						<div className="empty">
							<CatMark className="empty-cat" size={72} decorative />
							<p>
								Nothing here yet.
								<span className="empty-how">Send a note and it shows on your other devices.</span>
							</p>
						</div>
					) : (
						<div className="log log-sheet">
							{groupByDay(visible, now).map((group) => (
								<section className="log-day" key={group.key}>
									<h2 className="log-day-label">
										<span>{group.title}</span>
										{group.date ? <span className="log-day-date">{group.date}</span> : null}
									</h2>
									<ul className="log-day-items">
										<AnimatePresence initial={false}>
											{group.items.map((item) => {
												const remain = ttlRemain(item.expiresAt, itemTtl(item.kind), now);
												const warn = ttlWarn(item.expiresAt, now);
												const selected = item.id === selectedId;
												const locked = item.text === UNREADABLE;
												return (
													<motion.li
														key={item.id}
														layout={!reduceMotion}
														initial={
															reduceMotion
																? false
																: item.ephemeral
																	? { opacity: 0, y: -16, scale: 0.96 }
																	: { opacity: 0, y: -10 }
														}
														animate={{ opacity: 1, y: 0, scale: 1 }}
														exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
														transition={{
															duration: item.ephemeral ? 0.38 : 0.22,
															ease: [0.22, 1, 0.36, 1],
														}}
														className={[
															"log-item",
															item.ephemeral ? "is-ghost" : "",
															selected ? "is-selected" : "",
															item.kind === "image" || item.kind === "file" ? "has-file" : "",
														]
															.filter(Boolean)
															.join(" ")}
													>
														<span className="gutter">
															<span className="gutter-time">{formatClockTime(item.createdAt)}</span>
															{locked ? null : copiedId === item.id ? (
																<CatMark className="time-mark is-copied" size={24} decorative />
															) : (
																<PixelStamp seed={item.createdAt} />
															)}
														</span>
														<span className="rail" aria-hidden />
														{locked ? (
															<p className="body">
																{item.text}. <a href="/pair/show">Show a code</a> or{" "}
																<a href="/recover">use the 12 words</a>
															</p>
														) : item.kind === "image" || item.kind === "file" ? (
															<button
																type="button"
																className="body file-body"
																onClick={() => activateItem(item)}
															>
																<PixelThumb seed={item.id} label={item.text} />
																<span className="file-copy">
																	<span className="file-name">{item.text}</span>
																	<span className="file-meta">
																		{item.uploadProgress !== undefined
																			? `Sending ${Math.round(item.uploadProgress * 100)}%`
																			: item.kind === "image"
																				? "Image"
																				: "File"}
																	</span>
																</span>
															</button>
														) : (
															<button
																type="button"
																className="body"
																onClick={() => activateItem(item)}
															>
																{item.text}
															</button>
														)}
														<span className="log-actions">
															{item.kind !== "image" &&
															item.kind !== "file" &&
															textNeedsReader(item.text) ? (
																<button
																	type="button"
																	className="act"
																	onClick={() => activateItem(item)}
																>
																	OPEN
																</button>
															) : null}
															{item.kind === "image" || item.kind === "file" ? (
																<button
																	type="button"
																	className="act"
																	onClick={() => void openPreview(item)}
																>
																	PREVIEW
																</button>
															) : null}
															<button
																type="button"
																className="act"
																onClick={() => void onForget(item.id)}
															>
																FORGET
															</button>
														</span>
														<span
															className={
																item.uploadProgress !== undefined
																	? "ttl is-upload"
																	: warn
																		? "ttl warn"
																		: "ttl"
															}
															style={{
																["--remain" as string]: String(
																	item.uploadProgress !== undefined ? item.uploadProgress : remain,
																),
															}}
														/>
													</motion.li>
												);
											})}
										</AnimatePresence>
									</ul>
								</section>
							))}
						</div>
					)}
				</div>
			</div>
			<FilePreview
				preview={preview}
				onClose={() => setPreview(null)}
				onDownload={() => {
					const item = itemsRef.current.find((row) => row.previewUrl === preview?.url);
					if (item) {
						void downloadNote(item);
					}
				}}
			/>
			<NoteReader
				note={note}
				copied={copiedId === note?.id}
				onClose={() => setNote(null)}
				onCopy={() => {
					if (note) {
						void onCopy(note.text, note.id);
					}
				}}
			/>
		</main>
	);
}
