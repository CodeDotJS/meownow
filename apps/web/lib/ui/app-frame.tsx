"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { getJson, postJson } from "@/lib/client/http";
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
			const local = await loadVault();
			setHasLocal(local !== null);
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
				{ id: "login", label: "Continue with passkey", href: "/login" },
				{ id: "join", label: "Paste an invite code", href: "/join" },
				{ id: "pair", label: "This is a new device", href: "/pair" },
				{ id: "enroll", label: "First admin", href: "/enroll" },
				{ id: "recover", label: "Use the 12 words", href: "/recover" },
			];
		}
		const rows: PaletteAction[] = [{ id: "home", label: "Clipboard", href: "/" }];
		if (!me.hasVault) {
			rows.push({ id: "setup", label: "Finish setup", href: "/setup" });
		}
		if (me.hasVault && !hasLocal) {
			rows.push({ id: "pair", label: "Show a pairing QR", href: "/pair" });
		}
		if (hasLocal) {
			rows.push({ id: "scan", label: "Add a device", href: "/pair/scan" });
		}
		rows.push({ id: "recover", label: "Use the 12 words", href: "/recover" });
		if (!me.canUpload) {
			rows.push({ id: "access", label: "Request upload access", href: "/access" });
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
	}, [hasLocal, me]);

	return (
		<div className="frame">
			<header className="chrome">
				<a href="/" className="chrome-brand">
					meownow
				</a>
				<div className="chrome-right">
					{me ? <span className="chrome-handle mono">{me.handle}</span> : null}
					{me?.role === "admin" ? (
						<a className="chrome-add" href="/invites">
							Invites
						</a>
					) : null}
					{hasLocal ? (
						<a className="chrome-add" href="/pair/scan">
							Add device
						</a>
					) : null}
					<button type="button" className="chrome-k" onClick={() => setOpen(true)}>
						<kbd>{mod}</kbd>
					</button>
				</div>
			</header>
			{children}
			<CommandPalette open={open} onClose={() => setOpen(false)} actions={actions} />
		</div>
	);
}
