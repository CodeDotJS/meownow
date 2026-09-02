import { useHeadProgress } from "./head-progress";

export function HeadProgressBar({ busy }: { busy: boolean }) {
	const phase = useHeadProgress(busy);
	return (
		<span className={`log-head-progress is-${phase}`} aria-hidden>
			<span />
		</span>
	);
}
