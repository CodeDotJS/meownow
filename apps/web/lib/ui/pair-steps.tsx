export function PairSteps({ side }: { side: "new" | "working" }) {
	if (side === "new") {
		return (
			<ol className="steps">
				<li>This screen shows a code.</li>
				<li>On the computer that already works, tap Add a device and type it.</li>
				<li>If the numbers match, continue here.</li>
			</ol>
		);
	}
	return (
		<ol className="steps">
			<li>On the new browser, open meownow and show a code.</li>
			<li>Type that code here.</li>
			<li>If the numbers match, continue on the new browser.</li>
		</ol>
	);
}
