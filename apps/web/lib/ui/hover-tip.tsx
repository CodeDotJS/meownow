"use client";

import {
	cloneElement,
	type FocusEvent,
	type MouseEvent,
	type ReactElement,
	useEffect,
	useState,
} from "react";
import { createPortal } from "react-dom";

type TipTarget = {
	onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
	onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
	onFocus?: (event: FocusEvent<HTMLElement>) => void;
	onBlur?: (event: FocusEvent<HTMLElement>) => void;
};

export function HoverTip({
	label,
	place,
	children,
}: {
	label: string;
	place: "above" | "below";
	children: ReactElement<TipTarget>;
}) {
	const [box, setBox] = useState<DOMRect | null>(null);

	function show(target: EventTarget & HTMLElement): void {
		setBox(target.getBoundingClientRect());
	}

	function hide(): void {
		setBox(null);
	}

	useEffect(() => {
		if (!box) {
			return;
		}
		function close(): void {
			setBox(null);
		}
		window.addEventListener("scroll", close, true);
		window.addEventListener("resize", close);
		return () => {
			window.removeEventListener("scroll", close, true);
			window.removeEventListener("resize", close);
		};
	}, [box]);

	return (
		<>
			{cloneElement(children, {
				onMouseEnter: (event) => {
					children.props.onMouseEnter?.(event);
					show(event.currentTarget);
				},
				onMouseLeave: (event) => {
					children.props.onMouseLeave?.(event);
					hide();
				},
				onFocus: (event) => {
					children.props.onFocus?.(event);
					show(event.currentTarget);
				},
				onBlur: (event) => {
					children.props.onBlur?.(event);
					hide();
				},
			})}
			{box
				? createPortal(
						<span
							className={place === "below" ? "float-tip is-below" : "float-tip"}
							style={{
								left: box.left + box.width / 2,
								top: place === "below" ? box.bottom : box.top,
							}}
							role="tooltip"
						>
							{label}
						</span>,
						document.body,
					)
				: null}
		</>
	);
}
