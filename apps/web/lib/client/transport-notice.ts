export const TRANSPORT_NOTICE_HEADER = "x-meownow-notice";
export type TransportNotice = "ipv6_unreachable";

const DISMISS_KEY = "meownow.dismissed.ipv6_unreachable";

const listeners = new Set<(notice: TransportNotice | null) => void>();
let current: TransportNotice | null = null;

function isDismissed(notice: TransportNotice): boolean {
	try {
		return sessionStorage.getItem(DISMISS_KEY) === notice;
	} catch {
		return false;
	}
}

function emit(notice: TransportNotice | null): void {
	current = notice;
	for (const listener of listeners) {
		listener(current);
	}
}

export function publishTransportNotice(notice: TransportNotice): void {
	if (isDismissed(notice)) {
		return;
	}
	emit(notice);
}

export function dismissTransportNotice(notice: TransportNotice): void {
	try {
		sessionStorage.setItem(DISMISS_KEY, notice);
	} catch {
		// Private mode can block sessionStorage; hide for this page only.
	}
	if (current === notice) {
		emit(null);
	}
}

export function subscribeTransportNotice(
	listener: (notice: TransportNotice | null) => void,
): () => void {
	listeners.add(listener);
	listener(current);
	return () => {
		listeners.delete(listener);
	};
}

export function readTransportNotice(res: Response): void {
	const value = res.headers.get(TRANSPORT_NOTICE_HEADER);
	if (value === "ipv6_unreachable") {
		publishTransportNotice(value);
	}
}

export function resetTransportNoticeForTests(): void {
	current = null;
	listeners.clear();
	try {
		sessionStorage.removeItem(DISMISS_KEY);
	} catch {
		// jsdom without storage
	}
}
