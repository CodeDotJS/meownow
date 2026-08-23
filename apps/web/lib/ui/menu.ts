import type { PaletteAction } from "./palette";

export type MenuMe = {
	handle: string;
	role: "admin" | "member";
	canUpload: boolean;
	hasVault: boolean;
};

export function menuActions(me: MenuMe | null, hasLocal: boolean): PaletteAction[] {
	if (!me) {
		if (hasLocal) {
			return [
				{
					id: "login",
					label: "Sign in",
					hint: "This browser already has the clipboard",
					href: "/login",
				},
				{
					id: "pair",
					label: "Show a code",
					hint: "New passkey from the computer that still works",
					href: "/pair/show",
				},
			];
		}
		return [
			{ id: "login", label: "Sign in", hint: "Passkey already on this browser", href: "/login" },
			{
				id: "join",
				label: "Join with an invite",
				hint: "Someone sent you a link",
				href: "/join",
			},
			{
				id: "pair",
				label: "This browser is new",
				hint: "Show a code for the working device",
				href: "/pair/show",
			},
			{ id: "recover", label: "Lost every device", hint: "Use the 12 words", href: "/recover" },
			{ id: "enroll", label: "First admin", hint: "Bootstrap the first seat", href: "/enroll" },
		];
	}

	if (!me.hasVault) {
		return [
			{
				id: "setup",
				label: "Finish setup",
				hint: "Write down the 12 words",
				href: "/setup",
			},
			{ id: "logout", label: "Log out" },
		];
	}

	const pairing: PaletteAction[] = hasLocal
		? [
				{
					id: "add-device",
					label: "Add a device",
					hint: "Type the code the new browser shows",
					href: "/pair/scan",
				},
				{
					id: "pair",
					label: "Show a code",
					hint: "Only if this browser is the new one",
					href: "/pair/show",
				},
			]
		: [
				{
					id: "pair",
					label: "Show a code",
					hint: "This browser is new",
					href: "/pair/show",
				},
				{
					id: "add-device",
					label: "Add a device",
					hint: "Type the code the new browser shows",
					href: "/pair/scan",
				},
			];

	const rows: PaletteAction[] = [{ id: "home", label: "Clipboard", href: "/" }, ...pairing];

	if (!hasLocal) {
		rows.push({
			id: "recover",
			label: "Lost every device",
			hint: "Can't reach a working browser",
			href: "/recover",
		});
	}

	if (!me.canUpload) {
		rows.push({ id: "access", label: "Request file uploads", href: "/access" });
	}

	if (me.role === "admin") {
		rows.push(
			{ id: "admin", label: "People", hint: "Seats and devices", href: "/admin" },
			{ id: "invites", label: "Invites", hint: "Send a join link", href: "/invites" },
			{ id: "requests", label: "Requests", hint: "Grant file space", href: "/requests" },
		);
	}

	rows.push({ id: "logout", label: "Log out" });
	return rows;
}
