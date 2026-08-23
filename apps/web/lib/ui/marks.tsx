type MarkProps = {
	className?: string;
	size?: number;
	label?: string;
	decorative?: boolean;
};

export function CatMark({
	className,
	size = 28,
	label = "meownow",
	decorative = false,
}: MarkProps) {
	return (
		<img
			className={className}
			src="/marks/cat.svg"
			width={size}
			height={size}
			alt={decorative ? "" : label}
		/>
	);
}

export function EyeMark({
	className,
	size = 28,
	label = "We never see this",
	decorative = false,
}: MarkProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 512 512"
			aria-hidden={decorative ? true : undefined}
			role={decorative ? "presentation" : "img"}
			aria-label={decorative ? undefined : label}
		>
			{decorative ? null : <title>{label}</title>}
			<circle className="eye-sclera" cx="256" cy="256" r="256" />
			<circle className="eye-ring" cx="256" cy="256" r="132.414" />
			<circle className="eye-iris" cx="256" cy="256" r="119.172" />
			<circle className="eye-pupil" cx="256" cy="256" r="79.448" />
			<path
				className="eye-shine"
				d="M206.398,159.576c12.924,12.924,12.924,33.889,0,46.813s-33.889,12.924-46.813,0 c-12.932-12.924-6.347-27.304,6.577-40.236C179.085,153.229,193.465,146.653,206.398,159.576z"
			/>
		</svg>
	);
}
