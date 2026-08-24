"use client";

import { useEffect, useState } from "react";
import { isStandaloneDisplay } from "@/lib/pwa/standalone";

export function InstallHint() {
	const [show, setShow] = useState(false);

	useEffect(() => {
		const phone = window.matchMedia("(pointer: coarse)").matches;
		setShow(phone && !isStandaloneDisplay());
	}, []);

	if (!show) {
		return null;
	}

	return (
		<p className="install-hint">
			Install from the browser menu. Open it once online so the app still loads without a network.
		</p>
	);
}
