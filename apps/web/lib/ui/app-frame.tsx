"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { getJson, postJson } from "@/lib/client/http";
import { markStandalone } from "@/lib/pwa/standalone";
import { loadVault } from "@/lib/vault/idb";
import { dropStaleLocalVault } from "@/lib/vault/local";
import { CommandPalette, type PaletteAction } from "./palette";

type FrameMe = {
	handle: string;
	role: "admin" | "member";
	canUpload: boolean;
	hasVault: boolean;
};

export function AppFrame({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const [me, setMe] = useState<FrameMe | null>(null);
	const [hasLocal, setHasLocal] = useState(false);
	const [open, setOpen] = useState(false);
	const [mod, setMod] = useState("⌘K");

	useEffect(() => {
		const mac = /Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes("Mac");
		setMod(mac ? "⌘K" : "Ctrl K");
		markStandalone();
	}, []);

	useEffect(() => {
		void (async () => {
			void pathname;
			const res = await getJson("/api/auth/me");
			if (res.ok) {
				const profile = res.data as FrameMe;
				await dropStaleLocalVault(profile.hasVault);
				setMe(profile);
			} else {
				setMe(null);
			}
			setHasLocal((await loadVault()) !== null);
		})();
	}, [pathname]);

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((current) => !current);
			}
			if (event.key === "Escape" && open) {
				event.preventDefault();
				setOpen(false);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	const actions = useMemo((): PaletteAction[] => {
		if (!me) {
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
		const rows: PaletteAction[] = [{ id: "home", label: "Clipboard", href: "/" }];
		if (!me.hasVault) {
			rows.push({
				id: "setup",
				label: "Finish setup",
				hint: "Write down the 12 words",
				href: "/setup",
			});
		} else if (hasLocal) {
			rows.push(
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
			);
		} else {
			rows.push(
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
			);
		}
		rows.push({
			id: "recover",
			label: "Lost every device",
			hint: "Use the 12 words",
			href: "/recover",
		});
		if (!me.canUpload) {
			rows.push({ id: "access", label: "Request file uploads", href: "/access" });
		}
		if (me.role === "admin") {
			rows.push(
				{ id: "admin", label: "Admin", href: "/admin" },
				{ id: "invites", label: "Invites", href: "/invites" },
				{ id: "requests", label: "Upload requests", href: "/requests" },
				{ id: "audit", label: "Audit", href: "/admin/audit" },
				{ id: "usage", label: "Usage", href: "/admin/usage" },
			);
		}
		rows.push({
			id: "logout",
			label: "Log out",
			run: async () => {
				await postJson("/api/auth/logout", {});
				window.location.href = "/";
			},
		});
		return rows;
	}, [me, hasLocal]);

	return (
		<div className="frame">
			<header className="chrome">
				<a href="/" className="chrome-brand">
					meownow
				</a>
				<div className="chrome-right">
					{me ? <span className="chrome-handle">{me.handle}</span> : null}
					{me ? null : (
						<a className="chrome-add" href="/login">
							Sign in
						</a>
					)}
					{me?.role === "admin" ? (
						<a className="chrome-add chrome-desk" href="/invites">
							Invites
						</a>
					) : null}
					{me?.hasVault ? (
						<a className="chrome-add" href="/pair">
							<span className="chrome-wide">{hasLocal ? "Add a device" : "Show a code"}</span>
							<span className="chrome-narrow">{hasLocal ? "Add" : "Show"}</span>
						</a>
					) : null}
					<button type="button" className="chrome-menu" onClick={() => setOpen(true)}>
						<kbd className="chrome-kbd">{mod}</kbd>
						<span className="chrome-menu-word">Menu</span>
					</button>
				</div>
			</header>
			{children}
			<CommandPalette open={open} onClose={() => setOpen(false)} actions={actions} />
		</div>
	);
}
