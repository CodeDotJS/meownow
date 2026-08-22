"use client";

import { usePathname } from "next/navigation";

const LINKS = [
	{ href: "/admin", label: "People" },
	{ href: "/invites", label: "Invites" },
	{ href: "/requests", label: "Requests" },
	{ href: "/admin/usage", label: "Usage" },
	{ href: "/admin/audit", label: "Audit" },
] as const;

export function AdminNav() {
	const pathname = usePathname();
	return (
		<nav className="admin-nav" aria-label="Admin">
			{LINKS.map((link) => (
				<a
					key={link.href}
					href={link.href}
					className={pathname === link.href ? "is-on" : undefined}
					aria-current={pathname === link.href ? "page" : undefined}
				>
					{link.label}
				</a>
			))}
		</nav>
	);
}
