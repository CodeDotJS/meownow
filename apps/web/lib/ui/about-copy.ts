export const ABOUT_FLOW = [
	{
		id: "flow-seal",
		state: "plain",
		title: "This browser seals it",
		body: "WebCrypto AES-256-GCM, in this page, before a byte leaves. Filename, type, and preview go in the same envelope. The key stays on your devices.",
	},
	{
		id: "flow-courier",
		state: "sealed",
		title: "The courier sees ciphertext",
		body: "Servers learn owner, size, time, and kind. Not the text, the name, or the picture. A breach there still cannot read the clipboard.",
	},
	{
		id: "flow-path",
		state: "sealed",
		title: "Across, still sealed",
		body: "Local means a LAN path, not just the same Wi‑Fi. If that path is not there, a live device still gets the sealed note through the hub. Stored notes sit as ciphertext.",
	},
	{
		id: "flow-open",
		state: "open",
		title: "The other browser opens it",
		body: "Decrypt happens there, in that page. Notes last thirty days unless you pin them. Files last seven. Live only never lands in the store.",
	},
] as const;

export const ABOUT_FAQ = [
	{
		id: "about-in",
		q: "How do I get in?",
		a: "Someone already here sends an invite link. There is no public signup and no password. Without a link, ask from the home page and leave an email.",
	},
	{
		id: "about-passkey",
		q: "How do I sign in?",
		a: "A passkey — Face ID, Touch ID, or the lock on this phone. Nothing to type.",
	},
	{
		id: "about-pair",
		q: "How do I add another device?",
		a: "The new browser shows a short code. The one that already works types it. Both sides check a six-digit fingerprint so nothing in the middle can pretend to be you.",
	},
	{
		id: "about-words",
		q: "What if every device is gone?",
		a: "Setup shows twelve words once. Those words unlock this clipboard on a new browser. Keep them off the devices you use.",
	},
	{
		id: "about-ttl",
		q: "How long do things stay?",
		a: "Notes expire after thirty days. Files after seven. Pin a stored item to keep it. Live only never writes to the store, so a refresh drops it.",
	},
	{
		id: "about-live",
		q: "What is Live only?",
		a: "Skip the store. Another device that is live gets the sealed note over a direct channel, or through the hub if that channel is not open. If nobody else is live, it stays on this device.",
	},
	{
		id: "about-local",
		q: "Does the same Wi‑Fi make it Local?",
		a: "No. Many routers isolate devices on the same network. Local means the browsers found a LAN path. If they did not, a live send still arrives through the hub.",
	},
	{
		id: "about-read",
		q: "Can a server read what I copy?",
		a: "No. This page seals the text, the filename, the type, and the preview before anything leaves. Servers see owner, size, time, and kind.",
	},
	{
		id: "about-watch",
		q: "Does it watch my clipboard?",
		a: "No. A browser cannot watch the clipboard in the background. You paste or share here, then copy on the other device.",
	},
	{
		id: "about-kinds",
		q: "What can I send?",
		a: "Text, links, images, and files. Text stays under 64 KB. A file can be up to 100 MB, and files need upload permission.",
	},
	{
		id: "about-forget",
		q: "Can I take something back?",
		a: "Forget removes it from this tray. Stored items are deleted on the server. Live only notes only exist on the devices that already have them.",
	},
	{
		id: "about-leave",
		q: "Can I close my account?",
		a: "Yes. Sign in, open Account, type your username, and delete it. The last admin cannot. Notes already on other devices stay until those browsers forget them.",
	},
	{
		id: "about-sync",
		q: "What does Sync do?",
		a: "On writes sealed notes to the store when a network exists. Off keeps new notes on this browser until you tap Sync. Account holds the switch.",
	},
	{
		id: "about-offline",
		q: "Does it work without a network?",
		a: "This browser can open and write text and links from the local cache. Files still need a network. Live only still needs another live device.",
	},
] as const;

export const ABOUT_FAQ_COL = 7;

export const ABOUT_FAQ_TITLE = "Questions";
