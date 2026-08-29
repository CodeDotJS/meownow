export const SW_UPDATE_POLL_MS = 60 * 60 * 1000;

/** A first install must not nag. An update of a controlling worker should. */
export function shouldOfferSwUpdate(hadController: boolean, state: string): boolean {
	if (!hadController) {
		return false;
	}
	return state === "installed" || state === "activating" || state === "activated";
}

type SwLike = {
	state: string;
	addEventListener(type: "statechange", listener: () => void): void;
	removeEventListener(type: "statechange", listener: () => void): void;
};

export type SwRegistrationLike = {
	installing: SwLike | null;
	waiting: SwLike | null;
	addEventListener(type: "updatefound", listener: () => void): void;
	removeEventListener(type: "updatefound", listener: () => void): void;
	update(): Promise<unknown>;
};

export type SwContainerLike = {
	addEventListener(type: "controllerchange", listener: () => void): void;
	removeEventListener(type: "controllerchange", listener: () => void): void;
};

function watchWorker(
	worker: SwLike | null,
	hadController: boolean,
	onReady: () => void,
): () => void {
	if (!worker) {
		return () => undefined;
	}
	const check = () => {
		if (shouldOfferSwUpdate(hadController, worker.state)) {
			onReady();
		}
	};
	check();
	worker.addEventListener("statechange", check);
	return () => worker.removeEventListener("statechange", check);
}

/** Call `update()` when the tab wakes, and watch the installing worker. */
export function watchSwUpdate(
	registration: SwRegistrationLike,
	hadController: boolean,
	onReady: () => void,
	container?: SwContainerLike | null,
): () => void {
	const stops: Array<() => void> = [];
	stops.push(watchWorker(registration.waiting, hadController, onReady));
	stops.push(watchWorker(registration.installing, hadController, onReady));

	const onFound = () => {
		stops.push(watchWorker(registration.installing, hadController, onReady));
	};
	registration.addEventListener("updatefound", onFound);
	stops.push(() => registration.removeEventListener("updatefound", onFound));

	if (container) {
		const onController = () => {
			if (hadController) {
				onReady();
			}
		};
		container.addEventListener("controllerchange", onController);
		stops.push(() => container.removeEventListener("controllerchange", onController));
	}

	const poke = () => {
		void registration.update().catch(() => undefined);
	};
	const onWake = () => {
		if (document.visibilityState === "visible") {
			poke();
		}
	};
	document.addEventListener("visibilitychange", onWake);
	window.addEventListener("online", poke);
	const tick = window.setInterval(poke, SW_UPDATE_POLL_MS);
	poke();
	stops.push(() => {
		document.removeEventListener("visibilitychange", onWake);
		window.removeEventListener("online", poke);
		window.clearInterval(tick);
	});
	return () => {
		for (const stop of stops) {
			stop();
		}
	};
}
