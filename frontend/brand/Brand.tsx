/**
 * Building blocks of the Laufzettel identity (docs/redesign/LAUFZETTEL.md):
 *
 *   Mark       the "Wegmarke": the flag read as a route (two stations done, one waiting)
 *   Lockup     mark + "Laufzettel" + endorsement "oesterreich.gv.at 2030"
 *   Stamp      an office stamp in Stempelblau (or the citizen's red seal), one shape per kind of office
 *   Seal       the reward: guilloche rosette, one ring per station, done rings red
 *   Band       the security-print band at the head of documents
 *   InkFilter  SVG filter that gives stamps their uneven ink (render once per page)
 *
 * Colour rule: blue = an office did it, red = Austria and the citizen's own seal, yellow = needs you.
 */
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { drawBand, drawSeal } from "./print";

export function Mark({ size = 30, title, className = "" }: { size?: number; title?: string; className?: string }) {
	return (
		<svg
			className={`lz-mark ${className}`}
			width={size}
			height={size}
			viewBox="0 0 48 48"
			role={title ? "img" : undefined}
			aria-label={title}
			aria-hidden={title ? undefined : true}
			focusable="false"
		>
			<rect width="48" height="48" fill="#C8102E" />
			<rect y="16" width="48" height="16" fill="#FFFFFF" />
			<path d="M12 24H36" stroke="#C8102E" strokeWidth="2" />
			<circle cx="12" cy="24" r="4" fill="#C8102E" />
			<circle cx="24" cy="24" r="4" fill="#C8102E" />
			<circle cx="36" cy="24" r="3.4" fill="#FFFFFF" stroke="#C8102E" strokeWidth="2" />
		</svg>
	);
}

export function Lockup({ endorse = true, size = 30 }: { endorse?: boolean; size?: number }) {
	return (
		<span className="lz-lockup">
			<Mark size={size} />
			<span className="lz-lockup-name">Laufzettel</span>
			{endorse && <span className="lz-lockup-endorse">oesterreich.gv.at 2030</span>}
		</span>
	);
}

export type StampShape = "round" | "rect" | "oct" | "oval" | "ticket";

export type StampSpec = {
	shape: StampShape;
	/** Big word in the middle ("FILLED"), or initials for the citizen's seal. */
	main: string;
	/** Small line on top (office). Not used by round stamps. */
	top?: string;
	/** Text around the edge of round stamps, ends with " · ". */
	ring?: string;
	/** Short date ("15 OCT"). */
	date?: string;
	ink?: "blue" | "red";
	/** Initials instead of a word in the middle (citizen's seal). */
	big?: boolean;
	/** Degrees; small and varied, like a real hand stamp. */
	rotate?: number;
};

const INK = { blue: "#2A44B0", red: "#C8102E" };

function face(stretch: number, weight: number, size: number, spacing: number): CSSProperties {
	return { fontFamily: "Archivo, 'Arial Narrow', Arial, sans-serif", fontStretch: `${stretch}%`, fontWeight: weight, fontSize: size, letterSpacing: spacing };
}
const mono = (size: number): CSSProperties => ({ fontFamily: "'Martian Mono', ui-monospace, Menlo, monospace", fontSize: size, letterSpacing: 0.3 });
const up = (s?: string) => (s ?? "").toUpperCase();

function octagon(r: number) {
	return Array.from({ length: 8 }, (_, k) => {
		const a = Math.PI / 8 + (k * Math.PI) / 4;
		return `${(60 + r * Math.cos(a)).toFixed(1)},${(60 + r * Math.sin(a)).toFixed(1)}`;
	}).join(" ");
}

/** Shrinks long words so they stay inside the stamp. */
function fit(text: string, base: number, room: number) {
	return text.length > room ? Math.max(base * 0.62, (base * room) / text.length) : base;
}

export function Stamp({ spec, delay = 0, className = "" }: { spec: StampSpec; delay?: number; className?: string }) {
	const id = `ring${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const ink = spec.ink ?? "blue";
	const S = { fill: "none", stroke: "currentColor" } as const;
	const main = up(spec.main);
	let body;

	if (spec.shape === "round") {
		body = (
			<svg viewBox="0 0 120 120" aria-hidden="true">
				<defs>
					<path id={id} d="M60 60m-40 0a40 40 0 1 1 80 0a40 40 0 1 1-80 0" />
				</defs>
				<circle cx="60" cy="60" r="56" {...S} strokeWidth="3.4" />
				<circle cx="60" cy="60" r="51" {...S} strokeWidth="1.2" />
				<circle cx="60" cy="60" r="31" {...S} strokeWidth="1.2" />
				<text fill="currentColor" style={face(70, 800, 9.6, 1.2)}>
					<textPath href={`#${id}`} textLength="246" lengthAdjust="spacing">
						{up(spec.ring)}
					</textPath>
				</text>
				{spec.big ? (
					<text x="60" y="67" textAnchor="middle" fill="currentColor" style={face(125, 900, 23, -0.5)}>
						{main}
					</text>
				) : (
					<text x="60" y="58" textAnchor="middle" fill="currentColor" style={face(66, 800, fit(main, 10, 9), 0.6)}>
						{main}
					</text>
				)}
				<text x="60" y={spec.big ? 80 : 72} textAnchor="middle" fill="currentColor" style={mono(7)}>
					{up(spec.date)}
				</text>
			</svg>
		);
	} else if (spec.shape === "rect" || spec.shape === "ticket") {
		body = (
			<svg viewBox="0 0 160 72" aria-hidden="true">
				{spec.shape === "rect" ? (
					<>
						<rect x="3" y="3" width="154" height="66" {...S} strokeWidth="3.2" />
						<rect x="8.5" y="8.5" width="143" height="55" {...S} strokeWidth="1.1" />
					</>
				) : (
					<>
						<path d="M3 3H157V27a9 9 0 0 0 0 18V69H3V45a9 9 0 0 0 0-18Z" {...S} strokeWidth="3.2" />
						<path d="M16 9.5H144M16 62.5H144" {...S} strokeWidth="1.1" />
					</>
				)}
				<text x="80" y="24" textAnchor="middle" fill="currentColor" style={face(75, 700, fit(up(spec.top), 8.5, 24), 1.5)}>
					{up(spec.top)}
				</text>
				<text x="80" y="46" textAnchor="middle" fill="currentColor" style={face(62, 900, fit(main, 19, 11), 1.3)}>
					{main}
				</text>
				<text x="80" y="58.5" textAnchor="middle" fill="currentColor" style={mono(7.2)}>
					{up(spec.date)}
				</text>
			</svg>
		);
	} else if (spec.shape === "oval") {
		body = (
			<svg viewBox="0 0 150 84" aria-hidden="true">
				<ellipse cx="75" cy="42" rx="71" ry="38" {...S} strokeWidth="3.2" />
				<ellipse cx="75" cy="42" rx="65" ry="32" {...S} strokeWidth="1.1" />
				<text x="75" y="30" textAnchor="middle" fill="currentColor" style={face(75, 700, fit(up(spec.top), 8.5, 20), 1.5)}>
					{up(spec.top)}
				</text>
				<text x="75" y="50" textAnchor="middle" fill="currentColor" style={face(62, 900, fit(main, 17, 10), 1.2)}>
					{main}
				</text>
				<text x="75" y="62" textAnchor="middle" fill="currentColor" style={mono(7)}>
					{up(spec.date)}
				</text>
			</svg>
		);
	} else {
		body = (
			<svg viewBox="0 0 120 120" aria-hidden="true">
				<polygon points={octagon(56)} {...S} strokeWidth="3.2" strokeLinejoin="round" />
				<polygon points={octagon(50)} {...S} strokeWidth="1.1" />
				<text x="60" y="45" textAnchor="middle" fill="currentColor" style={face(75, 700, fit(up(spec.top), 8.5, 14), 1.4)}>
					{up(spec.top)}
				</text>
				<text x="60" y="66" textAnchor="middle" fill="currentColor" style={face(62, 900, fit(main, 17, 9), 1)}>
					{main}
				</text>
				<text x="60" y="80" textAnchor="middle" fill="currentColor" style={mono(7)}>
					{up(spec.date)}
				</text>
			</svg>
		);
	}

	const label = [spec.top, spec.main, spec.date].filter(Boolean).join(", ");
	return (
		<span
			className={`lz-stamp shape-${spec.shape} ink-${ink} ${className}`}
			style={{ color: INK[ink], "--r": `${spec.rotate ?? -4}deg`, "--d": `${delay}s` } as CSSProperties}
			role="img"
			aria-label={label}
		>
			{body}
		</span>
	);
}

/** Redraws a canvas whenever its size or the inputs change. */
function useCanvas(draw: (c: HTMLCanvasElement) => void, deps: unknown[]) {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const c = ref.current;
		if (!c) return;
		draw(c);
		const ro = new ResizeObserver(() => draw(c));
		ro.observe(c);
		return () => ro.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);
	return ref;
}

export function Seal({ done, total, caption, label, size = "lg" }: { done: number; total: number; caption: string; label: string; size?: "sm" | "md" | "lg" }) {
	const ref = useCanvas((c) => drawSeal(c, done, total), [done, total]);
	return (
		<div className={`lz-seal is-${size}`} role="img" aria-label={label}>
			<canvas ref={ref} aria-hidden="true" />
			<div className="lz-seal-count" aria-hidden="true">
				<b>{done}</b>
				<span>{caption}</span>
			</div>
		</div>
	);
}

export function Band({ className = "" }: { className?: string }) {
	const ref = useCanvas((c) => drawBand(c), []);
	return <canvas ref={ref} className={`lz-band ${className}`} aria-hidden="true" />;
}

export function InkFilter() {
	return (
		<svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
			<defs>
				<filter id="lz-ink" x="-15%" y="-15%" width="130%" height="130%">
					<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={11} result="n" />
					<feDisplacementMap in="SourceGraphic" in2="n" scale={2} xChannelSelector="R" yChannelSelector="G" result="d" />
					<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.5 0 0 0 .22" result="speck" />
					<feComposite in="d" in2="speck" operator="in" />
				</filter>
			</defs>
		</svg>
	);
}
