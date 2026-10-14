/**
 * The reward layer (nudging, see src/shared/stamps.ts for the rules):
 *   AmtsRing    life areas as a ring: an open area glows red, finished ones are full of light
 *   StampView   one rubber stamp in the Stempelpass (ink texture via the #ink SVG filter)
 *   StampPass   the paper page with all stamps
 *   InkFilter   the SVG filter, rendered once in App
 */
import type { Area, AreaId, Stamp } from "../src/shared/stamps";
import { Icon } from "./icons";
import type { UIText } from "./i18n";

const R = 48;
const C = 2 * Math.PI * R;
const SEG = C / 4;
const LEN = SEG - 12; // visible part of each segment (room for the round caps)

export function AmtsRing({ areas, t, onOpen }: { areas: Area[]; t: UIText; onOpen: (serviceId: string) => void }) {
	const sorted = areas.filter((a) => a.status !== "open").length;
	return (
		<div className="amtsring">
			<div className="ring-visual">
				<svg viewBox="0 0 120 120" aria-hidden="true">
					<circle className="ring-track" cx="60" cy="60" r={R} />
					{areas.map((a, i) => (
						<circle
							key={a.id}
							className={`ring-seg ${a.status}`}
							cx="60"
							cy="60"
							r={R}
							strokeDasharray={`${LEN} ${C - LEN}`}
							strokeDashoffset={-(i * SEG + (SEG - LEN) / 2)}
						/>
					))}
				</svg>
				<div className="ring-center">
					<b>
						{sorted} / {areas.length}
					</b>
					<span>{t.ringSub}</span>
				</div>
			</div>
			<ul className="ring-legend">
				{areas.map((a) => {
					const label = t.areas[a.id as AreaId];
					const status = a.status === "open" ? t.areaOpen : a.status === "done" ? t.areaDone : t.areaOk;
					return (
						<li key={a.id} className={a.status}>
							{a.status === "open" && a.serviceId ? (
								<button type="button" onClick={() => onOpen(a.serviceId!)}>
									<i aria-hidden="true" />
									<span>{label}</span>
									<small>{status}</small>
									<Icon name="arrowRight" size={16} />
								</button>
							) : (
								<span className="legend-item">
									<i aria-hidden="true" />
									<span>{label}</span>
									<small>{status}</small>
								</span>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/** Slightly different angle per stamp, stable for the same id (real stamps are never straight). */
function angleOf(id: string): number {
	let h = 0;
	for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
	return (h % 17) - 8;
}

export function StampView({ stamp, slam, t }: { stamp: Stamp; slam?: boolean; t?: UIText }) {
	return (
		<span
			className={`stamp ink-${stamp.ink} ${stamp.source} ${slam ? "slam" : ""}`}
			style={{ ["--tilt" as string]: `${angleOf(stamp.id)}deg` }}
			title={stamp.source === "record" && t ? t.stampFromData : undefined}
		>
			<span className="stamp-l1">{stamp.lines[0]}</span>
			<span className="stamp-l2">{stamp.lines[1]}</span>
			{stamp.date && <span className="stamp-date">{stamp.date}</span>}
		</span>
	);
}

export function StampPass({ stamps, t }: { stamps: Stamp[]; t: UIText }) {
	return (
		<div className="paper stamp-pass">
			<div className="paper-head">
				<span>{t.stampPass}</span>
				<span className="paper-count">{stamps.length}</span>
			</div>
			{stamps.length ? (
				<ul className="stamp-grid">
					{stamps.map((s) => (
						<li key={s.id}>
							<StampView stamp={s} t={t} />
							{s.source === "record" && <small>{t.stampFromData}</small>}
						</li>
					))}
				</ul>
			) : (
				<p className="paper-empty">{t.stampEmpty}</p>
			)}
		</div>
	);
}

export function TimeSaved({ minutes, label, t }: { minutes: number; label: string; t: UIText }) {
	return (
		<div className="time-saved">
			<span className="time-label">{t.timeSaved}</span>
			<b>{minutes ? label : "0"}</b>
			<small>{minutes ? t.timeSavedNote : t.timeSavedNone}</small>
		</div>
	);
}

/** Rough, slightly patchy ink for the stamps. Render once. */
export function InkFilter() {
	return (
		<svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
			<defs>
				<filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
					<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
					<feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" result="d" />
					<feComponentTransfer in="n" result="mask">
						<feFuncA type="table" tableValues="0.35 1 1 1" />
					</feComponentTransfer>
					<feComposite in="d" in2="mask" operator="in" />
				</filter>
			</defs>
		</svg>
	);
}

