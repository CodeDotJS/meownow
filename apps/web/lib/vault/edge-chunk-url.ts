/** Append `chunk` without turning `/dl` into `?dl?chunk=`. */
export function edgeChunkUrl(base: string, chunk: string): string {
	const url = new URL(base);
	url.searchParams.set("chunk", chunk);
	return url.href;
}
