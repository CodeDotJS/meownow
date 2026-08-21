"use client";

import { statusCopy } from "./copy";

export function Status({ value }: { value: string | null }) {
	if (!value) {
		return null;
	}
	return (
		<p className="status" role="status">
			{statusCopy(value)}
		</p>
	);
}
