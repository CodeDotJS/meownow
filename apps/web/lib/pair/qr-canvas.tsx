"use client";

import { useEffect, useRef } from "react";
import { encode } from "uqr";

export function PairingQrCanvas({ payload }: { payload: string }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !payload) {
			return;
		}
		const qr = encode(payload, { ecc: "M", border: 4 });
		const scale = 4;
		canvas.width = qr.size * scale;
		canvas.height = qr.size * scale;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return;
		}
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = "#14161a";
		for (let y = 0; y < qr.size; y += 1) {
			const row = qr.data[y];
			if (!row) {
				continue;
			}
			for (let x = 0; x < qr.size; x += 1) {
				if (row[x]) {
					ctx.fillRect(x * scale, y * scale, scale, scale);
				}
			}
		}
	}, [payload]);

	return <canvas ref={canvasRef} className="qr" aria-label="Pairing QR" />;
}
