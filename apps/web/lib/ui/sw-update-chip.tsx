"use client";

import { CatMark } from "./marks";

export function SwUpdateChip({ onReload }: { onReload: () => void }) {
	return (
		<button
			type="button"
			className="sw-update"
			onClick={onReload}
			aria-live="polite"
			aria-label="Reload for a newer meownow"
		>
			<CatMark className="sw-update-cat" size={40} decorative />
			<span className="sw-update-copy">
				<span className="sw-update-lead">A newer meownow</span>
				<span className="sw-update-act">Reload</span>
			</span>
		</button>
	);
}
