export function PairRoles({ current }: { current: "show" | "scan" }) {
	return (
		<nav className="pair-roles" aria-label="Pair or scan">
			<a className={current === "show" ? "pair-role select" : "pair-role"} href="/pair/show">
				Pair
			</a>
			<a className={current === "scan" ? "pair-role select" : "pair-role"} href="/pair/scan">
				Scan
			</a>
		</nav>
	);
}
