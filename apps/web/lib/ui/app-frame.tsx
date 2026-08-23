"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { getJson, postJson } from "@/lib/client/http";
import { markStandalone } from "@/lib/pwa/standalone";
import { loadVault } from "@/lib/vault/idb";
import { dropStaleLocalVault } from "@/lib/vault/local";
import { menuActions } from "./menu";
import { CommandPalette, type PaletteAction } from "./palette";
import { PixelAvatar } from "./pixel-avatar";

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
		return menuActions(me, hasLocal).map((row) =>
			row.id === "logout"
				? {
						...row,
						run: async () => {
							await postJson("/api/auth/logout", {});
							window.location.href = "/";
						},
					}
				: row,
		);
	}, [me, hasLocal]);

	return (
		<div className="frame">
			<header className="chrome">
				<a href="/" className="chrome-brand">
					meownow
				</a>
				<div className="chrome-right">
					{me ? (
						<a className="chrome-me" href="/account">
							<PixelAvatar label={me.handle} size={22} />
							<span className="chrome-handle">{me.handle}</span>
						</a>
					) : null}
					<a className="chrome-add" href="/about">
						About
					</a>
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
