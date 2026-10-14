/**
 * Pieces shared by the three goal pages (GoalsOverview, GoalDetail, GoalCelebration).
 * Navigation is a tiny hash router in App.tsx (#/goals, #/goals/<id>, #/goals/<id>/done).
 */
import type { ReactNode } from "react";
import type { Language } from "../../src/shared/types";
import { VoiceMark } from "../components";
import type { UIText } from "../i18n";
import type { GoalIconName, Progress } from "./data";

export type Common = { t: UIText; lang: Language; progress: Progress; go: (hash: string) => void };

/** The assistant's speech bubble, same look as the answer on the start screen. */
export function Bot({ children }: { children: ReactNode }) {
	return (
		<div className="answer goal-bot" aria-live="polite">
			<VoiceMark state="idle" size="sm" />
			<p>{children}</p>
		</div>
	);
}

/** Simple line icons (inherit the text colour), calmer than emoji. */
const ICON_PATHS: Record<GoalIconName, ReactNode> = {
	home: <path d="M3 11 12 4l9 7M5 9.5V20h5v-6h4v6h5V9.5" />,
	car: (
		<>
			<path d="M3 16v-4l2.2-5h13.6L21 12v4H3Z" />
			<path d="M3 12h18M6 16v3M18 16v3" />
			<circle cx="7.5" cy="14" r="0.6" />
			<circle cx="16.5" cy="14" r="0.6" />
		</>
	),
	passport: (
		<>
			<rect x="5" y="3" width="14" height="18" rx="2" />
			<circle cx="12" cy="10" r="3" />
			<path d="M9 16h6" />
		</>
	),
	eu: (
		<>
			{Array.from({ length: 12 }, (_, i) => {
				const a = (i * Math.PI) / 6;
				return <circle key={i} cx={12 + 7 * Math.sin(a)} cy={12 - 7 * Math.cos(a)} r="1.1" />;
			})}
		</>
	),
	family: (
		<>
			<circle cx="8" cy="7" r="2.5" />
			<circle cx="16.5" cy="10" r="2" />
			<path d="M3.5 20v-4a4.5 4.5 0 0 1 9 0v4M13 20v-2.5a3.5 3.5 0 0 1 7 0V20" />
		</>
	),
};

export function GoalIcon({ name, className = "goal-icon" }: { name: GoalIconName; className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			{ICON_PATHS[name]}
		</svg>
	);
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
	return (
		<div className="goal-bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
			<div className={value === 100 ? "goal-bar-fill full" : "goal-bar-fill"} style={{ width: `${value}%` }} />
		</div>
	);
}
