"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { postJson } from "@/lib/client/http";
import {
	dismissTransportNotice,
	subscribeTransportNotice,
	type TransportNotice,
} from "@/lib/client/transport-notice";
import { discardPlayIfLocal } from "@/lib/play/hero";
import { idbPlayStore } from "@/lib/play/store";
import { markStandalone } from "@/lib/pwa/standalone";
import { subscribeHub } from "@/lib/vault/hub-live";
import { statusCopy } from "./copy";
import { HoverTip } from "./hover-tip";
import { CatMark } from "./marks";
import { menuActions } from "./menu";
import { CommandPalette, type PaletteAction } from "./palette";
import { PixelAvatar } from "./pixel-avatar";
import { asMenuMe, clearBrowserSession, hydrateBrowserSession } from "./session-cache";

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
	const [notice, setNotice] = useState<TransportNotice | null>(null);
	const [live, setLive] = useState(false);

	useEffect(() => {
		const mac = /Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes("Mac");
		setMod(mac ? "⌘K" : "Ctrl K");
		markStandalone();
	}, []);

	useEffect(() => {
		void (async () => {
			void pathname;
			const session = await hydrateBrowserSession();
			setMe(session.me ? asMenuMe(session.me) : null);
			setHasLocal(session.hasLocal);
			void discardPlayIfLocal(session.hasLocal, idbPlayStore);
		})();
	}, [pathname]);

	useEffect(() => subscribeTransportNotice(setNotice), []);

	useEffect(() => {
		if (!me || !hasLocal) {
			setLive(false);
			return;
		}
		return subscribeHub({ onLive: setLive });
	}, [me, hasLocal]);

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
							clearBrowserSession();
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
					<CatMark className="chrome-cat" size={22} decorative />
					meownow
				</a>
				<div className="chrome-right">
					{me ? (
						<a className="chrome-me" href="/account">
							<PixelAvatar label={me.handle} size={22} />
							<span className="chrome-handle">{me.handle}</span>
						</a>
					) : null}
					<a className={me ? "chrome-add chrome-desk" : "chrome-add"} href="/about">
						About
					</a>
					{me ? null : (
						<>
							<a className="chrome-add" href="/play">
								Playground
							</a>
							<a className="chrome-add" href="/login">
								Sign in
							</a>
						</>
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
					{me ? (
						<HoverTip label={live ? "Live on your devices" : "Connecting…"} place="below">
							<button
								type="button"
								className={live ? "chrome-live is-on" : "chrome-live"}
								aria-label={live ? "Live on your devices" : "Connecting…"}
							>
								<span className="chrome-live-dot" aria-hidden />
							</button>
						</HoverTip>
					) : null}
					<button type="button" className="chrome-menu" onClick={() => setOpen(true)}>
						<kbd className="chrome-kbd">{mod}</kbd>
						<span className="chrome-menu-word">Menu</span>
					</button>
				</div>
			</header>
			{notice ? (
				<div className="frame-notice" role="status">
					<p>{statusCopy(notice)}</p>
					<button type="button" className="quiet" onClick={() => dismissTransportNotice(notice)}>
						Dismiss
					</button>
				</div>
			) : null}
			{children}
			<CommandPalette open={open} onClose={() => setOpen(false)} actions={actions} />
		</div>
	);
}
