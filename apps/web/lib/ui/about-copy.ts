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
		body: "Decrypt happens there, in that page. Text and links last thirty days. Images and files last seven. Live only never lands in the store.",
	},
] as const;

export const ABOUT_FAQ = [
	{
		id: "about-in",
		q: "How do I get in?",
		a: "An admin sends an invite link. There is no public signup and no password. Ask on the home page only leaves an email — it does not get you in. Playground on the home page is five text, link, or image notes in this browser. That is not a seat.",
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
		a: "Setup shows twelve words once. Those unlock this clipboard if every device is gone. If one still works, pair instead. Keep the words off the devices you use.",
	},
	{
		id: "about-others",
		q: "Do other people here see what I copy?",
		a: "No. An invite is an account, not a shared tray. Only this account's devices can open what you copy.",
	},
	{
		id: "about-kinds",
		q: "What can I send?",
		a: "Text, links, images, and files. Paste a photo on the page. Notes are markdown in this browser; what is stored is still ciphertext of the source. Type :smile: for emoji. Edit a text or link in place. Text stays under 64 KB. A stored file can be up to 100 MB.",
	},
	{
		id: "about-ttl",
		q: "How long do things stay?",
		a: "Text and links last thirty days. Images and files last seven. At the deadline they leave the tray, then the store. Reset deadlines on Account sets every stored note, image, and file to thirty days from today. If you do not tap it, they leave at their deadline. There is no keep-forever control. Live only is gone on refresh.",
	},
	{
		id: "about-live",
		q: "What is Live only?",
		a: "Skip the store. Another device that is live gets the sealed note over a direct channel, or through the hub if that channel is not open. If nobody else is live, it stays on this device until you refresh.",
	},
	{
		id: "about-local",
		q: "Does the same Wi‑Fi make it Local?",
		a: "No. Many routers isolate devices on the same network. Local means the browsers found a LAN path. If they did not, a live send still arrives through the hub.",
	},
	{
		id: "about-forget",
		q: "Can I take something back?",
		a: "Forget removes it from this tray. A stored note is deleted on the server. A note that never left this browser is only dropped here. Live only notes only exist on the devices that already have them.",
	},
	{
		id: "about-read",
		q: "Can a server read what I copy?",
		a: "No. The clipboard seals the text, the filename, the type, and the preview before anything leaves. Servers see owner, size, time, and kind.",
	},
	{
		id: "about-watch",
		q: "Does it watch my clipboard?",
		a: "No. A browser cannot watch the clipboard in the background. You paste or share here, then copy on the other device.",
	},
	{
		id: "about-sync",
		q: "What does Sync do?",
		a: "On, the default, writes sealed text and links to the store when a network exists, and queues them here when it does not. Other devices see a queued note after this browser is back online. Off holds new text and links here until you tap Sync. Turning it off does not pull stored notes back. Files and images never wait. Account on this browser also holds clip long notes, tap to copy, Tab indents, which panes show, and Reset deadlines.",
	},
	{
		id: "about-offline",
		q: "Does it work without a network?",
		a: "This browser must already have the clipboard and must have loaded once online. Then you can open and write text and links from the local cache, including after you close the tab. Files and images need a network. Live only needs another live device, and a refresh drops it.",
	},
	{
		id: "about-upload",
		q: "Why can't I send a file?",
		a: "Text and links do not need permission. Images and files do. Ask from the menu; an admin grants 25 to 100 MB.",
	},
	{
		id: "about-two",
		q: "Do I need another device?",
		a: "One browser can hold a tray. This browser can show write, the notes, or both — ⌘\\ or Ctrl \\ cycles. Paste on a phone or laptop needs that browser paired.",
	},
	{
		id: "about-install",
		q: "Should I install it?",
		a: "The tab is enough. Install from the browser menu for the home screen. Open it once online so the app can still load without a network. When a newer build is waiting, a cat chip asks you to reload.",
	},
	{
		id: "about-share",
		q: "Can I share into it from another app?",
		a: "On Android, an installed meownow can take shared text and links. iOS does not. Paste here instead.",
	},
	{
		id: "about-arrive",
		q: "How do I know something arrived?",
		a: "When another of your devices stores a note, this one can show a notification that names the account, not the paste. Open the app to read it.",
	},
	{
		id: "about-leave",
		q: "Can I close my account?",
		a: "Yes. Sign in, open Account, type your username, and delete it. The last admin cannot. Notes already on other devices stay until those browsers forget them.",
	},
] as const;

export const ABOUT_FAQ_COL = 10;

export const ABOUT_FAQ_TITLE = "Questions";
