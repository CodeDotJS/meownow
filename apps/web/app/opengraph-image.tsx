import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "meownow. Copy here. Paste there.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const cat = `data:image/png;base64,${readFileSync(
	join(process.cwd(), "public/icons/icon-192.png"),
).toString("base64")}`;

export default function OpengraphImage() {
	return new ImageResponse(
		<div
			style={{
				background: "#EEF0F3",
				color: "#17181C",
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				padding: "80px 88px",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 16,
					fontSize: 28,
					fontWeight: 560,
					letterSpacing: "-0.04em",
					marginBottom: 48,
				}}
			>
				<img src={cat} width={44} height={44} alt="" />
				meownow
			</div>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					fontSize: 64,
					lineHeight: 1.05,
					letterSpacing: "-0.05em",
					fontWeight: 500,
				}}
			>
				<div style={{ display: "flex" }}>Copy here.</div>
				<div style={{ display: "flex" }}>Paste there.</div>
			</div>
		</div>,
		{ ...size },
	);
}
