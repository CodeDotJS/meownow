import { ImageResponse } from "next/og";

export const alt = "meownow — copy on this device. paste on the other.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
	return new ImageResponse(
		<div
			style={{
				background: "#F1F2F4",
				color: "#14161A",
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
					fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
					fontSize: 28,
					marginBottom: 48,
				}}
			>
				meownow
			</div>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					fontSize: 64,
					lineHeight: 1.1,
					letterSpacing: "-0.04em",
					fontFamily: "sans-serif",
				}}
			>
				<div
					style={{ display: "flex", background: "#2C46F0", color: "#FFFFFF", padding: "4px 12px" }}
				>
					Copy
				</div>
				<div style={{ display: "flex", padding: "4px 8px" }}>on this device.</div>
			</div>
			<div
				style={{
					display: "flex",
					fontSize: 64,
					lineHeight: 1.1,
					letterSpacing: "-0.04em",
					marginTop: 8,
					fontFamily: "sans-serif",
				}}
			>
				Paste on the other.
			</div>
		</div>,
		{ ...size },
	);
}
