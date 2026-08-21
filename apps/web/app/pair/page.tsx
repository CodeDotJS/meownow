export default function PairHubPage() {
	return (
		<main>
			<h1>Pair or scan</h1>
			<p className="lead">
				One browser shows a QR. The other scans it in meownow. The phone Camera app will not finish
				this.
			</p>
			<div className="pair-choice">
				<a className="pair-card" href="/pair/show">
					<h2>Pair</h2>
					<p>This browser is new. Show a QR for the working device to scan.</p>
				</a>
				<a className="pair-card" href="/pair/scan">
					<h2>Scan</h2>
					<p>This browser already works. Point the camera at the QR on the new one.</p>
				</a>
			</div>
		</main>
	);
}
