import type { Metadata, Viewport } from "next";
import { Martian_Mono, Outfit } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { PwaSerwist } from "@/lib/pwa/serwist-provider";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { AppFrame } from "@/lib/ui/app-frame";
import "./globals.css";

const outfit = Outfit({
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
	metadataBase: new URL(SITE_URL),
	applicationName: "meownow",
	title: {
		default: "meownow",
		template: "%s · meownow",
	},
	description: SITE_DESCRIPTION,
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "meownow",
	},
	formatDetection: { telephone: false },
	icons: {
		icon: [
			{ url: "/marks/cat.svg", type: "image/svg+xml" },
			{ url: "/favicon.ico", sizes: "32x32" },
			{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
			{ url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
		],
		apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
	},
	openGraph: {
		title: "meownow",
		description: SITE_DESCRIPTION,
		siteName: "meownow",
		type: "website",
		locale: "en",
	},
	twitter: {
		card: "summary_large_image",
		title: "meownow",
		description: SITE_DESCRIPTION,
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: "#eef0f3",
	colorScheme: "only light",
	viewportFit: "cover",
	interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
	await connection();
	return (
		<html lang="en" className={`${outfit.variable} ${martianMono.variable}`}>
			<body>
				<PwaSerwist>
					<AppFrame>{children}</AppFrame>
				</PwaSerwist>
			</body>
		</html>
	);
}
