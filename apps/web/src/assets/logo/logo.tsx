/** Matches `public/brand/logo.svg` (light strokes for dark UI). */
export default function Logo() {
	return (
		<svg
			aria-label="Wherabouts"
			className="h-8 w-auto"
			role="img"
			viewBox="0 0 152 124"
			xmlns="http://www.w3.org/2000/svg"
		>
			<title>wherabouts</title>
			<circle
				cx="14"
				cy="16"
				fill="none"
				r="9.5"
				stroke="#FFFFFF"
				strokeWidth="3.5"
			/>
			<path
				d="M14,16 L38,72 L76,30 L114,72 L138,16"
				fill="none"
				stroke="#FFFFFF"
				strokeDasharray="15 11"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="11"
			/>
			<circle cx="138" cy="16" fill="#C8C8C8" r="6.5" />
			<path d="M131,16 L145,16 L138,34 Z" fill="#C8C8C8" />
			<text
				fill="#FFFFFF"
				fontFamily="'JetBrains Mono', ui-monospace, monospace"
				fontSize="22"
				fontWeight="300"
				letterSpacing="-0.2"
				textAnchor="middle"
				x="76"
				y="112"
			>
				wherabouts
			</text>
		</svg>
	);
}
