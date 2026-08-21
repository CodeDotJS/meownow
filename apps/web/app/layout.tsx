import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Martian_Mono } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
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
	description: "Private clipboard",
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
};

export const viewport: Viewport = {
	themeColor: "#14161a",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
	await connection();
	return (
		<html lang="en" className={`${instrumentSans.variable} ${martianMono.variable}`}>
			<body>{children}</body>
		</html>
	);
}
