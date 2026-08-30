import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	title: "Playground",
	description: "Five notes in this browser. An invite unlocks the rest.",
};

export default function PlayLayout({ children }: { children: ReactNode }) {
	return children;
}
