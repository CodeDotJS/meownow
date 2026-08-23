import type { Metadata } from "next";
import { LitterMark } from "@/lib/ui/marks";

export const metadata: Metadata = {
	title: "No mice here",
	robots: { index: false, follow: false },
};

export default function NotFound() {
	return (
		<main className="miss">
			<div className="miss-stage">
				<LitterMark className="miss-mark" size={176} decorative />
				<h1>No mice here.</h1>
				<p className="lead">Dug through the box. This path is empty.</p>
				<nav className="miss-go">
					<a className="select" href="/">
						Home
					</a>
				</nav>
			</div>
		</main>
	);
}
