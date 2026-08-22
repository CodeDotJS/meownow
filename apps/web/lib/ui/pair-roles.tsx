export function PairRoles({ current }: { current: "show" | "scan" }) {
	if (current === "show") {
		return (
			<p className="pair-role-line">
				This browser is new. <a href="/pair/scan">This one already works</a>
			</p>
		);
	}
	return (
		<p className="pair-role-line">
			This browser already works. <a href="/pair/show">This one is new</a>
		</p>
	);
}
