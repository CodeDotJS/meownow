import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Read a PNG from `public/` without assuming Vercel's cwd is `apps/web`. */
export function publicPngDataUri(relativeFromPublic: string): string {
	const candidates = [
		join(process.cwd(), "public", relativeFromPublic),
		join(process.cwd(), "apps/web/public", relativeFromPublic),
	];
	for (const path of candidates) {
		try {
			return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
		} catch {
			// try the next layout
		}
	}
	throw new Error(`missing public file: ${relativeFromPublic}`);
}
