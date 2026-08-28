import type { ReactNode } from "react";

type MarkProps = {
	className?: string;
	size?: number;
	label?: string;
	decorative?: boolean;
};

function MarkSvg({
	className,
	size,
	label,
	decorative,
	viewBox,
	children,
}: MarkProps & { viewBox: string; children: ReactNode }) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox={viewBox}
			aria-hidden={decorative ? true : undefined}
			role={decorative ? "presentation" : "img"}
			aria-label={decorative ? undefined : label}
		>
			{decorative ? null : <title>{label}</title>}
			{children}
		</svg>
	);
}

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

export function LitterMark({
	className,
	size = 160,
	label = "litter box",
	decorative = false,
}: MarkProps) {
	return (
		<img
			className={className}
			src="/marks/litter.svg"
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

export function SendMark({ className, size = 18, label = "Send", decorative = false }: MarkProps) {
	return (
		<MarkSvg
			className={className}
			size={size}
			label={label}
			decorative={decorative}
			viewBox="0 0 24 24"
		>
			<path
				fill="currentColor"
				d="M16.1391 2.95907L7.10914 5.95907C1.03914 7.98907 1.03914 11.2991 7.10914 13.3191L9.78914 14.2091L10.6791 16.8891C12.6991 22.9591 16.0191 22.9591 18.0391 16.8891L21.0491 7.86907C22.3891 3.81907 20.1891 1.60907 16.1391 2.95907ZM16.4591 8.33907L12.6591 12.1591C12.5091 12.3091 12.3191 12.3791 12.1291 12.3791C11.9391 12.3791 11.7491 12.3091 11.5991 12.1591C11.3091 11.8691 11.3091 11.3891 11.5991 11.0991L15.3991 7.27907C15.6891 6.98907 16.1691 6.98907 16.4591 7.27907C16.7491 7.56907 16.7491 8.04907 16.4591 8.33907Z"
			/>
		</MarkSvg>
	);
}

export function WifiMark({
	className,
	size = 18,
	label = "Live only",
	decorative = false,
}: MarkProps) {
	return (
		<MarkSvg
			className={className}
			size={size}
			label={label}
			decorative={decorative}
			viewBox="0 0 32 32"
		>
			<path
				fill="currentColor"
				d="M6,17a1,1,0,0,1-1-.73l-4-14A1,1,0,0,1,3,1.73l4,14A1,1,0,0,1,6.27,17,.84.84,0,0,1,6,17Z"
			/>
			<path
				fill="currentColor"
				d="M26,17a.84.84,0,0,1-.27,0A1,1,0,0,1,25,15.72l4-14A1,1,0,0,1,31,2.27l-4,14A1,1,0,0,1,26,17Z"
			/>
			<rect fill="currentColor" height="6" rx="1" ry="1" width="6" x="3" y="15" />
			<rect fill="currentColor" height="6" rx="1" ry="1" width="6" x="23" y="15" />
			<rect fill="currentColor" height="12" rx="2" ry="2" width="30" x="1" y="19" />
			<circle fill="currentColor" cx="8" cy="25" r="3" />
			<path fill="currentColor" d="M26,24H19a1,1,0,0,0,0,2h7a1,1,0,0,0,0-2Z" />
			<path fill="currentColor" d="M15,24H14a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Z" />
			<path
				fill="currentColor"
				d="M21,9.5a1,1,0,0,1-.83-.45A4.62,4.62,0,0,0,16.33,7h-.66a4.63,4.63,0,0,0-3.84,2.05A1,1,0,1,1,10.17,8,6.58,6.58,0,0,1,15.67,5h.66a6.58,6.58,0,0,1,5.5,3,1,1,0,0,1-.28,1.38A.94.94,0,0,1,21,9.5Z"
			/>
			<path
				fill="currentColor"
				d="M18.5,11.75a1,1,0,0,1-.83-.45,1.82,1.82,0,0,0-1.51-.8h-.32a1.82,1.82,0,0,0-1.51.8,1,1,0,1,1-1.66-1.1,3.78,3.78,0,0,1,3.17-1.7h.32a3.77,3.77,0,0,1,3.17,1.7,1,1,0,0,1-.28,1.38A.94.94,0,0,1,18.5,11.75Z"
			/>
			<path fill="currentColor" d="M16.5,14h-1a1,1,0,0,1,0-2h1a1,1,0,0,1,0,2Z" />
		</MarkSvg>
	);
}

export function FolderMark({
	className,
	size = 18,
	label = "File",
	decorative = false,
}: MarkProps) {
	return (
		<MarkSvg
			className={className}
			size={size}
			label={label}
			decorative={decorative}
			viewBox="0 0 24 24"
		>
			<path
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M3.35791 12.7787C2.74772 13.7201 2.99956 15.0291 3.50323 17.647C3.8658 19.5316 4.04709 20.4738 4.67523 21.0991C4.8382 21.2614 5.02054 21.4052 5.2186 21.5277C5.98195 21.9999 6.99539 21.9999 9.02227 21.9999H15.9777C18.0046 21.9999 19.0181 21.9999 19.7814 21.5277C19.9795 21.4052 20.1618 21.2614 20.3248 21.0991C20.9529 20.4738 21.1342 19.5316 21.4968 17.647C22.0004 15.0291 22.2523 13.7201 21.6421 12.7787C21.4864 12.5384 21.2943 12.321 21.0721 12.1332C20.2011 11.3975 18.7933 11.3975 15.9777 11.3975H9.02227C6.20667 11.3975 4.79888 11.3975 3.92792 12.1332C3.70566 12.321 3.51363 12.5384 3.35791 12.7787ZM9.69518 17.1806C9.69518 16.7814 10.0376 16.4577 10.4601 16.4577H14.5398C14.9622 16.4577 15.3047 16.7814 15.3047 17.1806C15.3047 17.5798 14.9622 17.9035 14.5398 17.9035H10.4601C10.0376 17.9035 9.69518 17.5798 9.69518 17.1806Z"
			/>
			<path
				fill="currentColor"
				opacity="0.5"
				d="M3.5762 12.4846C3.68271 12.3586 3.80034 12.241 3.92792 12.1332C4.79888 11.3975 6.20667 11.3975 9.02227 11.3975H15.9777C18.7933 11.3975 20.2011 11.3975 21.0721 12.1332C21.2 12.2413 21.3179 12.3592 21.4247 12.4857V9.75579C21.4247 8.84687 21.4247 8.09279 21.3394 7.49156C21.2494 6.85704 21.0531 6.29458 20.5839 5.83245C20.5074 5.75707 20.4266 5.68552 20.342 5.61807C19.8302 5.21023 19.2167 5.04345 18.5222 4.96608C17.8531 4.89155 17.0102 4.89157 15.9769 4.89158L15.6242 4.89158C14.6421 4.89158 14.29 4.88587 13.9711 4.80533C13.7837 4.75802 13.604 4.69195 13.4352 4.60878C13.151 4.46867 12.9033 4.25762 12.2077 3.64132L11.7336 3.22128C11.5345 3.04489 11.3987 2.9245 11.2531 2.81755C10.6284 2.35879 9.86779 2.08132 9.07145 2.01534C8.88602 1.99998 8.6968 1.99999 8.41356 2.00002L8.29714 2.00001C7.65647 1.9999 7.23365 1.99983 6.86652 2.0612C5.26167 2.32947 3.96392 3.45143 3.64782 4.93575C3.57591 5.27344 3.57602 5.66035 3.57619 6.21853L3.5762 12.4846Z"
			/>
		</MarkSvg>
	);
}

export function DeleteMark({
	className,
	size = 16,
	label = "Forget",
	decorative = false,
}: MarkProps) {
	return (
		<MarkSvg
			className={className}
			size={size}
			label={label}
			decorative={decorative}
			viewBox="0 0 24 24"
		>
			<path
				fill="currentColor"
				d="M9.2 3.25h5.6c.28 0 .54.14.7.37l.7 1.03h3.05c.55 0 1 .45 1 1s-.45 1-1 1H3.75c-.55 0-1-.45-1-1s.45-1 1-1H6.8l.7-1.03c.16-.23.42-.37.7-.37Zm.55 1.9-.2.3h4.9l-.2-.3H9.75ZM7.1 9.15c0-.55.45-1 1-1h7.8c.55 0 1 .45 1 1v8.1c0 1.44-1.16 2.6-2.6 2.6H9.7c-1.44 0-2.6-1.16-2.6-2.6V9.15Zm2.65 1.45c0-.41-.34-.75-.75-.75s-.75.34-.75.75v5.4c0 .41.34.75.75.75s.75-.34.75-.75v-5.4Zm4.1-.75c.41 0 .75.34.75.75v5.4c0 .41-.34.75-.75.75s-.75-.34-.75-.75v-5.4c0-.41.34-.75.75-.75Z"
			/>
		</MarkSvg>
	);
}

export function OpenMark({ className, size = 15, label = "Open", decorative = false }: MarkProps) {
	return (
		<MarkSvg
			className={className}
			size={size}
			label={label}
			decorative={decorative}
			viewBox="0 0 24 24"
		>
			<path
				fill="currentColor"
				d="M9.2 3.4H5.7A2.3 2.3 0 0 0 3.4 5.7v3.5a1 1 0 1 0 2 0V6.3c0-.5.4-.9.9-.9h3.9a1 1 0 0 0 0-2Zm5.6 0a1 1 0 1 0 0 2h3.5c.5 0 .9.4.9.9v3.5a1 1 0 1 0 2 0V5.7A2.3 2.3 0 0 0 18.3 3.4h-3.5ZM4.4 13.8a1 1 0 0 1 1 1v3.5c0 .5.4.9.9.9h3.5a1 1 0 1 1 0 2H5.7A2.3 2.3 0 0 1 3.4 18.3v-3.5a1 1 0 0 1 1-1Zm15.2 0a1 1 0 0 1 1 1v3.5a2.3 2.3 0 0 1-2.3 2.3h-3.5a1 1 0 1 1 0-2h3.5c.5 0 .9-.4.9-.9v-3.5a1 1 0 0 1 1-1Z"
			/>
		</MarkSvg>
	);
}

export function EditMark({ className, size = 15, label = "Edit", decorative = false }: MarkProps) {
	return (
		<MarkSvg
			className={className}
			size={size}
			label={label}
			decorative={decorative}
			viewBox="0 0 24 24"
		>
			<path
				fill="currentColor"
				d="M15.4 4.3c.6-.6 1.5-.6 2.1 0l2.2 2.2c.6.6.6 1.5 0 2.1L9.1 19.2H4.8v-4.3L15.4 4.3Zm1.5 1.6-1.1-1.1-8.8 8.8v1.1h1.1l8.8-8.8Z"
			/>
		</MarkSvg>
	);
}

export function PreviewMark({
	className,
	size = 15,
	label = "Preview",
	decorative = false,
}: MarkProps) {
	return (
		<MarkSvg
			className={className}
			size={size}
			label={label}
			decorative={decorative}
			viewBox="0 0 24 24"
		>
			<path
				fill="currentColor"
				d="M12 5.2c4.7 0 8.6 3.2 9.9 6.8-1.3 3.6-5.2 6.8-9.9 6.8S3.4 15.6 2.1 12C3.4 8.4 7.3 5.2 12 5.2Zm0 2.3A4.5 4.5 0 1 0 16.5 12 4.5 4.5 0 0 0 12 7.5Zm0 2.2A2.3 2.3 0 1 1 9.7 12 2.3 2.3 0 0 1 12 9.7Z"
			/>
		</MarkSvg>
	);
}

export function SyncMark({ className, size = 15, label = "Sync", decorative = false }: MarkProps) {
	return (
		<MarkSvg
			className={className}
			size={size}
			label={label}
			decorative={decorative}
			viewBox="0 0 24 24"
		>
			<path
				fill="currentColor"
				d="M12 2.7c5.1 0 9.3 4.2 9.3 9.3a1.45 1.45 0 0 1-2.9 0 6.4 6.4 0 1 0-6.4 6.4 1.45 1.45 0 0 1 0 2.9A9.3 9.3 0 1 1 12 2.7Z"
			/>
		</MarkSvg>
	);
}
