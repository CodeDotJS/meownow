import type { Metadata } from "next";
import { About } from "@/lib/ui/about";

export const metadata: Metadata = {
	title: "About",
	description:
		"A clipboard for people who already know each other. Sealed before it leaves this page.",
};

export default function AboutPage() {
	return <About />;
}
