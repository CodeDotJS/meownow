/** Clipboard and picker previews use the original File. Upload must not send an empty canvas rewrite. */
export function shouldKeepOriginalImageBytes(
	bitmap: { width: number; height: number } | null,
	blob: Blob | null,
): boolean {
	if (!bitmap || bitmap.width < 1 || bitmap.height < 1) {
		return true;
	}
	return !blob || blob.size === 0;
}

export function emptyPlaintextError(bytes: Uint8Array): "item_invalid" | null {
	return bytes.byteLength === 0 ? "item_invalid" : null;
}
