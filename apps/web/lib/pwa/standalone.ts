export function isStandaloneDisplay(): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	if (window.matchMedia("(display-mode: standalone)").matches) {
		return true;
	}
	const safari = window.navigator as Navigator & { standalone?: boolean };
	return safari.standalone === true;
}

export function markStandalone(): void {
	document.documentElement.classList.toggle("is-standalone", isStandaloneDisplay());
}
