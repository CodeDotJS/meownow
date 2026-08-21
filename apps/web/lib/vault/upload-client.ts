import {
	decrypt,
	decryptChunks,
	encrypt,
	encryptChunks,
	generateFileKey,
	unwrapFileKey,
	wrapFileKey,
} from "@meownow/crypto";
import { BLOB_TTL_MS, FILE_MAX_BYTES } from "@meownow/protocol";
import { errorCode, postJson } from "../client/http";
import { loadVault } from "./idb";
import { b64urlToBytes, bytesToB64url, wrapFromWire, wrapToWire } from "./wire";

export async function sendBlobFile(file: File): Promise<
	| {
			id: string;
			text: string;
			expiresAt: string;
			kind: "image" | "file";
			blobId: string;
			metaCiphertext: string;
			iv: string;
			wrappedKey: { iv: string; bytes: string };
	  }
	| { error: string }
> {
	const stored = await loadVault();
	if (!stored) {
		return { error: "vault_missing" };
	}
	const bytes = await readForUpload(file);
	if (bytes.byteLength > FILE_MAX_BYTES) {
		return { error: "item_invalid" };
	}
	const id = crypto.randomUUID();
	const kind = file.type.startsWith("image/") ? ("image" as const) : ("file" as const);
	const fileKey = await generateFileKey();
	const sealed = await encryptChunks(fileKey, bytes, { itemId: id, kind });
	const wrapped = await wrapFileKey(stored.vaultKey, fileKey);
	const metaPlain = new TextEncoder().encode(
		JSON.stringify({
			filename: file.name,
			mime: file.type || "application/octet-stream",
			size: bytes.byteLength,
			baseIv: bytesToB64url(sealed.baseIv),
		}),
	);
	const meta = await encrypt(stored.vaultKey, metaPlain, { itemId: id, kind });
	const chunkCount = sealed.chunks.length + 1;
	const cipherBytes =
		sealed.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0) + sealed.trailer.byteLength;
	const intent = await postJson("/api/uploads/intent", { kind, byteSize: cipherBytes, chunkCount });
	if (!intent.ok) {
		return { error: errorCode(intent.data) };
	}
	const { blobId, uploadUrl } = intent.data as { blobId: string; uploadUrl: string };
	const hash = await sha256Concat([...sealed.chunks, sealed.trailer]);
	for (let i = 0; i < sealed.chunks.length; i += 1) {
		const chunk = sealed.chunks[i];
		if (!chunk) {
			continue;
		}
		const put = await putChunk(uploadUrl, blobId, String(i), chunk);
		if (put) {
			return { error: put };
		}
	}
	const trailerPut = await putChunk(uploadUrl, blobId, "trailer", sealed.trailer);
	if (trailerPut) {
		return { error: trailerPut };
	}
	const expiresAt = new Date(Date.now() + BLOB_TTL_MS).toISOString();
	const commit = await postJson("/api/uploads/commit", {
		blobId,
		itemId: id,
		kind,
		metaCiphertext: bytesToB64url(meta.bytes),
		iv: bytesToB64url(meta.iv),
		wrappedKey: wrapToWire(wrapped),
		chunkSize: 1_048_576,
		chunkCount: sealed.chunks.length,
		sha256: bytesToB64url(hash),
		expiresAt,
	});
	if (!commit.ok) {
		return { error: errorCode(commit.data) };
	}
	return {
		id,
		text: file.name,
		expiresAt,
		kind,
		blobId,
		metaCiphertext: bytesToB64url(meta.bytes),
		iv: bytesToB64url(meta.iv),
		wrappedKey: wrapToWire(wrapped),
	};
}

export async function downloadBlobItem(item: {
	id: string;
	kind: "image" | "file";
	blobId: string;
	iv: string;
	metaCiphertext: string;
	wrappedKey: { iv: string; bytes: string };
}): Promise<void> {
	const stored = await loadVault();
	if (!stored) {
		return;
	}
	const metaBytes = await decrypt(
		stored.vaultKey,
		{ iv: b64urlToBytes(item.iv), bytes: b64urlToBytes(item.metaCiphertext) },
		{ itemId: item.id, kind: item.kind },
	);
	const meta = JSON.parse(new TextDecoder().decode(metaBytes)) as {
		filename?: string;
		baseIv?: string;
	};
	if (!meta.baseIv) {
		return;
	}
	const fileKey = await unwrapFileKey(stored.vaultKey, wrapFromWire(item.wrappedKey));
	const chunks: Uint8Array[] = [];
	for (let i = 0; i < 1024; i += 1) {
		const body = await getChunk(item.blobId, String(i));
		if (!body) {
			break;
		}
		chunks.push(body);
	}
	const trailer = await getChunk(item.blobId, "trailer");
	if (!trailer) {
		return;
	}
	const plain = await decryptChunks(
		fileKey,
		{ baseIv: b64urlToBytes(meta.baseIv), chunks, trailer },
		{ itemId: item.id, kind: item.kind },
	);
	const blob = new Blob([toArrayBuffer(plain)]);
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = meta.filename || "download";
	link.rel = "noopener";
	link.click();
	URL.revokeObjectURL(url);
}

async function putChunk(
	uploadUrl: string,
	blobId: string,
	chunk: string,
	bytes: Uint8Array,
): Promise<string | null> {
	const ticket = await postJson("/api/uploads/ticket", { blobId, purpose: "upload" });
	if (!ticket.ok) {
		return errorCode(ticket.data);
	}
	const { token } = ticket.data as { token: string };
	const res = await fetch(`${uploadUrl}?chunk=${encodeURIComponent(chunk)}`, {
		method: "PUT",
		headers: {
			authorization: `Bearer ${token}`,
			"content-length": String(bytes.byteLength),
			"content-type": "application/octet-stream",
		},
		body: toArrayBuffer(bytes),
	});
	if (!res.ok) {
		return "item_invalid";
	}
	return null;
}

async function getChunk(blobId: string, chunk: string): Promise<Uint8Array | null> {
	const ticket = await postJson("/api/uploads/ticket", { blobId, purpose: "download" });
	if (!ticket.ok) {
		return null;
	}
	const { token, url } = ticket.data as { token: string; url: string };
	const res = await fetch(`${url}?chunk=${encodeURIComponent(chunk)}`, {
		headers: { authorization: `Bearer ${token}` },
	});
	if (!res.ok) {
		return null;
	}
	return new Uint8Array(await res.arrayBuffer());
}

async function readForUpload(file: File): Promise<Uint8Array> {
	if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
		return new Uint8Array(await file.arrayBuffer());
	}
	try {
		const bitmap = await createImageBitmap(file);
		const canvas = document.createElement("canvas");
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return new Uint8Array(await file.arrayBuffer());
		}
		ctx.drawImage(bitmap, 0, 0);
		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob((next) => resolve(next), "image/png");
		});
		if (!blob) {
			return new Uint8Array(await file.arrayBuffer());
		}
		return new Uint8Array(await blob.arrayBuffer());
	} catch {
		return new Uint8Array(await file.arrayBuffer());
	}
}

async function sha256Concat(parts: Uint8Array[]): Promise<Uint8Array> {
	const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const joined = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		joined.set(part, offset);
		offset += part.byteLength;
	}
	return new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(joined)));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}
