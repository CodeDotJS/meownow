"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type PaletteAction = {
	id: string;
	label: string;
	hint?: string;
	href?: string;
	run?: () => void | Promise<void>;
};

export function CommandPalette({
	open,
	onClose,
	actions,
}: {
	open: boolean;
	onClose: () => void;
	actions: PaletteAction[];
}) {
	const router = useRouter();
	const boxRef = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState(0);

	useEffect(() => {
		if (!open) {
			return;
		}
		setActive(0);
		const id = window.requestAnimationFrame(() => boxRef.current?.focus());
		return () => window.cancelAnimationFrame(id);
	}, [open]);

	useEffect(() => {
		if (active >= actions.length) {
			setActive(Math.max(0, actions.length - 1));
		}
	}, [actions.length, active]);

	async function go(action: PaletteAction | undefined) {
		if (!action) {
			return;
		}
		onClose();
		if (action.run) {
			await action.run();
			return;
		}
		if (action.href) {
			router.push(action.href);
		}
	}

	if (!open) {
		return null;
	}

	return (
		<div className="palette-layer">
			<button type="button" className="palette-dismiss" aria-label="Close" onClick={onClose} />
			<div
				className="palette"
				ref={boxRef}
				role="dialog"
				aria-modal="true"
				aria-label="Menu"
				tabIndex={-1}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						onClose();
						return;
					}
					if (event.key === "ArrowDown") {
						event.preventDefault();
						setActive((i) => Math.min(actions.length - 1, i + 1));
						return;
					}
					if (event.key === "ArrowUp") {
						event.preventDefault();
						setActive((i) => Math.max(0, i - 1));
						return;
					}
					if (event.key === "Enter") {
						event.preventDefault();
						void go(actions[active]);
					}
				}}
			>
				<p className="palette-label">Menu</p>
				<ul className="palette-list">
					{actions.map((action, index) => (
						<li key={action.id}>
							<button
								type="button"
								className={index === active ? "palette-item is-active" : "palette-item"}
								onMouseEnter={() => setActive(index)}
								onClick={() => void go(action)}
							>
								<span>{action.label}</span>
								{action.hint ? <span className="palette-hint">{action.hint}</span> : null}
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
