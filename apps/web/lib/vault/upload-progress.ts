/** Client-only upload meter. Never sent to the server. */
export function blobUploadProgress(
	step: "read" | "compress" | "encrypt" | "chunk" | "commit",
	chunkIndex = 0,
	chunkTotal = 1,
): number {
	if (step === "read") {
		return 0.08;
	}
	if (step === "compress") {
		return 0.12;
	}
	if (step === "encrypt") {
		return 0.18;
	}
	if (step === "commit") {
		return 1;
	}
	const total = Math.max(1, chunkTotal);
	return 0.18 + 0.72 * ((chunkIndex + 1) / total);
}
