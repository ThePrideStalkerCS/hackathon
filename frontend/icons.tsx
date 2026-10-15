/**
 * Small inline icon set (stroke icons, 24×24). No icon font, no emoji: crisp at every text size
 * and they inherit the text colour. Decorative by default (aria-hidden); give the BUTTON a label.
 */
import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
	mic: (
		<>
			<rect x="9" y="3" width="6" height="11" rx="3" />
			<path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
		</>
	),
	keyboard: (
		<>
			<rect x="3" y="6" width="18" height="12" rx="2.5" />
			<path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
		</>
	),
	arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
	arrowRight: <path d="M5 12h14M13 5l7 7-7 7" />,
	arrowDown: <path d="M12 5v14M5 12l7 7 7-7" />,
	headset: (
		<>
			<path d="M4 15v-3a8 8 0 0 1 16 0v3" />
			<path d="M20 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2zM4 15a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2z" />
			<path d="M18 17v.5a3.5 3.5 0 0 1-3.5 3.5H12" />
		</>
	),
	play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
	pause: <path d="M9 6v12M15 6v12" />,
	check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
	pencil: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
	chevronDown: <path d="M6 9l6 6 6-6" />,
	replay: (
		<>
			<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" />
			<path d="M3.5 3.5v5h5" />
		</>
	),
	close: <path d="M6 6l12 12M18 6L6 18" />,
	lock: (
		<>
			<rect x="5" y="11" width="14" height="9" rx="2" />
			<path d="M8 11V8a4 4 0 0 1 8 0v3" />
		</>
	),
	home: <path d="M3.5 11L12 4l8.5 7v8.5a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" />,
	idCard: (
		<>
			<rect x="3" y="5" width="18" height="14" rx="2.5" />
			<circle cx="9" cy="11" r="2.5" />
			<path d="M5.5 16.5c.6-1.6 1.9-2.5 3.5-2.5s2.9.9 3.5 2.5M14.5 10h4M14.5 13.5h3" />
		</>
	),
	heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
	alert: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7.5v5.5M12 16.5h.01" />
		</>
	),
	x: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M9 9l6 6M15 9l-6 6" />
		</>
	),
	checkCircle: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M8 12.5l3 3 5-6" />
		</>
	),
	calendar: (
		<>
			<rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
			<path d="M3.5 10h17M8 3v4M16 3v4" />
		</>
	),
	sparkle: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />,
	fingerprint: <path d="M12 4a8 8 0 0 0-8 8M17 6a8 8 0 0 1 3 6c0 3-1 5-2 7M12 7a5 5 0 0 0-5 5v2M12 10a2 2 0 0 0-2 2v4M14 12v3c0 2-1 4-2 5M17 12c0 2-.4 3.5-1 5" />,
	mail: (
		<>
			<rect x="3" y="5" width="18" height="14" rx="2" />
			<path d="M3.6 6.6 12 13l8.4-6.4" />
		</>
	),
	sun: (
		<>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
		</>
	),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, strokeWidth = 2 }: { name: IconName; size?: number; strokeWidth?: number }) {
	return (
		<svg
			className="icon"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{PATHS[name]}
		</svg>
	);
}

/** Icon per service, used on suggestion cards. */
export const SERVICE_ICON: Record<string, IconName> = {
	"change-of-residence": "home",
	"passport-renewal": "idCard",
	"childcare-subsidy": "heart",
};
