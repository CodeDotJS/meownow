import { Panel } from "@/lib/ui/panel";

export default function AboutPage() {
	return (
		<main>
			<Panel>
				<article className="about">
					<h1>About</h1>
					<p className="lead">
						A private clipboard for people who already know each other. Copy on one device. Paste on
						another. Text, links, pictures, files.
					</p>

					<h2>How you get in</h2>
					<p>
						Someone who is already here sends you an invite link. There is no public signup and no
						password. If you landed here without a link, ask them for one.
					</p>

					<h2>What we never see</h2>
					<p>
						What you copy is sealed on your device before it leaves the browser. We cannot read the
						text, the filenames, or the pictures. The servers only move sealed data and forget it
						when it expires.
					</p>

					<h2>Signing in</h2>
					<p>
						You unlock meownow with a passkey — Face ID, Touch ID, or the lock on this phone. There
						is nothing to type and nothing to reset.
					</p>

					<h2>Another device</h2>
					<p>
						After you are in, add another browser with a short code. The new one shows the code. The
						one that already works types it. Both sides check a few numbers so nothing in the middle
						can pretend to be you.
					</p>

					<h2>If every device is gone</h2>
					<p>
						The first time you set up, this browser shows twelve words. Those words unlock the
						clipboard on a new browser. Keep them off this device.
					</p>

					<h2>How long things stay</h2>
					<p>
						Notes expire. Files do not live here forever. Treat it as a handoff, not an archive.
					</p>
				</article>
			</Panel>
		</main>
	);
}
