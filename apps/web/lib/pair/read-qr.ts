import type { PairingQr } from "@meownow/protocol";
import { pairingQrFromRaw } from "./qr";

type Detector = {
	detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

let detector: Detector | null | undefined;
let decoder: Promise<typeof import("jsqr").default> | null = null;

// Roughly 45 kB that most people never execute: it is only the fallback for
// browsers without BarcodeDetector, and only once the camera is running.
function loadDecoder(): Promise<typeof import("jsqr").default> {
	decoder ??= import("jsqr").then((mod) => mod.default);
	return decoder;
}

function barcodeDetector(): Detector | null {
	if (detector !== undefined) {
		return detector;
	}
	if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
		detector = null;
		return detector;
	}
	try {
		const Ctor = (
			window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => Detector }
		).BarcodeDetector;
		detector = new Ctor({ formats: ["qr_code"] });
	} catch {
		detector = null;
	}
	return detector;
}

export async function readPairingQrFromVideo(
	video: HTMLVideoElement,
	canvas: HTMLCanvasElement,
): Promise<{ qr: PairingQr; raw: string } | null> {
	if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth < 8) {
		return null;
	}
	const native = barcodeDetector();
	if (native) {
		try {
			const found = await native.detect(video);
			const value = found[0]?.rawValue;
			if (value) {
				const parsed = pairingQrFromRaw(value);
				if (parsed) {
					return parsed;
				}
			}
		} catch {
			// fall through to jsqr
		}
	}
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) {
		return null;
	}
	const scale = Math.min(1, 480 / video.videoWidth);
	const width = Math.max(1, Math.floor(video.videoWidth * scale));
	const height = Math.max(1, Math.floor(video.videoHeight * scale));
	canvas.width = width;
	canvas.height = height;
	ctx.drawImage(video, 0, 0, width, height);
	const image = ctx.getImageData(0, 0, width, height);
	const jsQR = await loadDecoder();
	const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
	return code?.data ? pairingQrFromRaw(code.data) : null;
}
