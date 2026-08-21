import { Instrument_Sans, Martian_Mono } from "next/font/google";
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

export const metadata = {
	title: "meownow",
	description: "Private clipboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={`${instrumentSans.variable} ${martianMono.variable}`}>
			<body>{children}</body>
		</html>
	);
}
