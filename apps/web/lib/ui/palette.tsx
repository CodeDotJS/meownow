"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
	const inputRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) {
			return actions;
		}
		return actions.filter((action) => {
			const hay = `${action.label} ${action.hint ?? ""} ${action.id}`.toLowerCase();
			return hay.includes(q);
		});
	}, [actions, query]);

	useEffect(() => {
		if (!open) {
			return;
		}
		setQuery("");
		setActive(0);
		const id = window.requestAnimationFrame(() => inputRef.current?.focus());
		return () => window.cancelAnimationFrame(id);
	}, [open]);

	useEffect(() => {
		if (active >= filtered.length) {
			setActive(Math.max(0, filtered.length - 1));
		}
	}, [active, filtered.length]);

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
			<div className="palette" role="dialog" aria-modal="true" aria-label="Menu">
				<label>
					<span className="palette-label">Menu</span>
					<input
						placeholder="Go somewhere"
						ref={inputRef}
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
							setActive(0);
						}}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								event.preventDefault();
								onClose();
								return;
							}
							if (event.key === "ArrowDown") {
								event.preventDefault();
								setActive((i) => Math.min(filtered.length - 1, i + 1));
								return;
							}
							if (event.key === "ArrowUp") {
								event.preventDefault();
								setActive((i) => Math.max(0, i - 1));
								return;
							}
							if (event.key === "Enter") {
								event.preventDefault();
								void go(filtered[active]);
							}
						}}
						autoComplete="off"
						spellCheck={false}
					/>
				</label>
				<ul className="palette-list">
					{filtered.length === 0 ? (
						<li className="palette-empty">No match.</li>
					) : (
						filtered.map((action, index) => (
							<li key={action.id}>
								<button
									type="button"
									className={index === active ? "palette-item is-active" : "palette-item"}
									onMouseEnter={() => setActive(index)}
									onClick={() => void go(action)}
								>
									<span>{action.label}</span>
									{action.hint ? <span className="mono">{action.hint}</span> : null}
								</button>
							</li>
						))
					)}
				</ul>
			</div>
		</div>
	);
}
