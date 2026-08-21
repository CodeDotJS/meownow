import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Martian_Mono } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AppFrame } from "@/lib/ui/app-frame";
import "./globals.css";

const instrumentSans = Instrument_Sans({
	subsets: ["latin"],
	variable: "--font-ui",
	display: "swap",
});

const martianMono = Martian_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
	display: "swap",
});

export const metadata: Metadata = {
	applicationName: "meownow",
	title: "meownow",
	description: "Copy on one device. Paste on the next.",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "meownow",
	},
	formatDetection: { telephone: false },
	icons: {
		icon: "/icons/icon-192.png",
		apple: "/icons/icon-192.png",
	},
	openGraph: {
		title: "meownow",
		description: "Copy on one device. Paste on the next.",
		siteName: "meownow",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "meownow",
		description: "Copy on one device. Paste on the next.",
	},
};

export const viewport: Viewport = {
	themeColor: "#f1f2f4",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
	await connection();
	return (
		<html lang="en" className={`${instrumentSans.variable} ${martianMono.variable}`}>
			<body>
				<AppFrame>{children}</AppFrame>
			</body>
		</html>
	);
}
