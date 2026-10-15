/**
 * Building blocks of the Laufzettel identity (docs/redesign/LAUFZETTEL.md):
 *
 *   Mark       the "Wegmarke": the flag read as a route (two stations done, one waiting)
 *   Lockup     mark + "Laufzettel" + endorsement "oesterreich.gv.at 2030"
 *   Stamp      an office stamp in Stempelblau (or the citizen's red seal), one hand-pressed shape per
 *              kind of office, with a small sprig of the errand's motif
 *   Band       the security-print band at the head of documents
 *   InkFilter  SVG filter that gives stamps their uneven ink (render once per page)
 *
 * Colour rule: blue = an office did it, red = Austria and the citizen's own seal, yellow = needs you.
 */
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { sprigLayers, type Motif } from "./motifs";
import { drawBand } from "./print";

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
	/** The word in the middle ("Filled in"), or initials for the citizen's seal. */
	main: string;
	/** Small line on top (office). Not used by round stamps. */
	top?: string;
	/** Text around the edge of round stamps, ends with " · ". */
	ring?: string;
	/** Short date ("15 Oct"). */
	date?: string;
	ink?: "blue" | "red";
	/** Initials instead of a word in the middle (citizen's seal). */
	big?: boolean;
	/** Degrees; small and varied, like a real hand stamp. */
	rotate?: number;
	/** A small sprig of the errand's motif, so office stamps belong to the same life event as the emblem. */
	sprig?: Motif;
};

const INK = { blue: "#2A44B0", red: "#C8102E" };

const display = (size: number): CSSProperties => ({ fontFamily: "Fraunces, Georgia, serif", fontWeight: 600, fontSize: size, fontVariationSettings: '"SOFT" 100, "opsz" 36' });
const text = (size: number, weight = 600): CSSProperties => ({ fontFamily: "'Atkinson Hyperlegible Next', 'Atkinson Hyperlegible', system-ui, sans-serif", fontWeight: weight, fontSize: size, letterSpacing: 0.2 });

/** A hand-pressed outline: a superellipse (n = 2 is an ellipse, higher is squarer) whose edge moves a little. */
function pressed(cx: number, cy: number, a: number, b: number, n: number, seed: number, scallop = 0): string {
	const pts: string[] = [];
	const steps = 120;
	for (let i = 0; i <= steps; i++) {
		const th = (i / steps) * Math.PI * 2;
		const c = Math.cos(th);
		const sn = Math.sin(th);
		const wob = 1 + (0.012 * Math.sin(5 * th + seed) + 0.008 * Math.sin(11 * th + seed * 2)) + scallop * Math.cos(12 * th);
		const x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * wob;
		const y = b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * wob;
		pts.push(`${(cx + x).toFixed(2)},${(cy + y).toFixed(2)}`);
	}
	return `M${pts.join("L")}Z`;
}

/** Shrinks long words so they stay inside the stamp. */
function fit(text: string, base: number, room: number) {
	return text.length > room ? Math.max(base * 0.62, (base * room) / text.length) : base;
}

function Sprig({ motif, x, y, k = 1 }: { motif: Motif; x: number; y: number; k?: number }) {
	return (
		<g transform={`translate(${x},${y}) scale(${k})`}>
			{sprigLayers(motif).map((l, i) => (
				<path key={i} d={l.d} fill={l.c === "paper" ? "var(--papier, #fffdf7)" : "currentColor"} />
			))}
		</g>
	);
}

export function Stamp({ spec, delay = 0, className = "" }: { spec: StampSpec; delay?: number; className?: string }) {
	const id = `ring${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const ink = spec.ink ?? "blue";
	const S = { fill: "none", stroke: "currentColor", strokeLinejoin: "round" } as const;
	const seed = (spec.rotate ?? 0) + spec.main.length;
	const main = spec.main;
	let body;

	if (spec.shape === "round") {
		body = (
			<svg viewBox="0 0 120 120" aria-hidden="true">
				<defs>
					<path id={id} d="M60 60m-41 0a41 41 0 1 1 82 0a41 41 0 1 1-82 0" />
				</defs>
				<path d={pressed(60, 60, 56, 56, 2, seed)} {...S} strokeWidth="3.2" />
				<path d={pressed(60, 60, 31, 31, 2, seed + 3)} {...S} strokeWidth="1.1" />
				<text fill="currentColor" style={text(8.6)}>
					<textPath href={`#${id}`} textLength="250" lengthAdjust="spacing">
						{spec.ring}
					</textPath>
				</text>
				{spec.big ? (
					<text x="60" y="69" textAnchor="middle" fill="currentColor" style={{ ...display(25), fontStyle: "italic" }}>
						{main}
					</text>
				) : (
					<>
						{spec.sprig && <Sprig motif={spec.sprig} x={60} y={44} k={0.78} />}
						<text x="60" y="66" textAnchor="middle" fill="currentColor" style={display(fit(main, 12, 8))}>
							{main}
						</text>
					</>
				)}
				<text x="60" y={spec.big ? 82 : 77} textAnchor="middle" fill="currentColor" style={text(7.4, 500)}>
					{spec.date}
				</text>
			</svg>
		);
	} else if (spec.shape === "oct") {
		body = (
			<svg viewBox="0 0 120 120" aria-hidden="true">
				<path d={pressed(60, 60, 54, 54, 2, seed, 0.028)} {...S} strokeWidth="3.2" />
				<path d={pressed(60, 60, 46, 46, 2, seed + 2)} {...S} strokeWidth="1" strokeDasharray="0.1 3.2" strokeLinecap="round" />
				{spec.sprig && <Sprig motif={spec.sprig} x={60} y={35} k={0.8} />}
				<text x="60" y="61" textAnchor="middle" fill="currentColor" style={text(fit(spec.top ?? "", 8.6, 14))}>
					{spec.top}
				</text>
				<text x="60" y="78" textAnchor="middle" fill="currentColor" style={display(fit(main, 15.5, 9))}>
					{main}
				</text>
				<text x="60" y="90" textAnchor="middle" fill="currentColor" style={text(7.4, 500)}>
					{spec.date}
				</text>
			</svg>
		);
	} else {
		const oval = spec.shape === "oval";
		const W = oval ? 150 : 160;
		const H = oval ? 84 : 72;
		const tx = spec.sprig ? W / 2 + 14 : W / 2;
		body = (
			<svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
				<path d={oval ? pressed(75, 42, 71, 38, 2, seed) : pressed(80, 36, 76, 32.5, spec.shape === "rect" ? 5 : 3.4, seed)} {...S} strokeWidth="3" />
				<path
					d={oval ? pressed(75, 42, 64.5, 31.5, 2, seed + 4) : pressed(80, 36, 70, 26.5, spec.shape === "rect" ? 5 : 3.4, seed + 4)}
					{...S}
					strokeWidth="1"
					strokeDasharray={spec.shape === "ticket" ? "0.1 3.2" : undefined}
					strokeLinecap="round"
				/>
				{spec.sprig && <Sprig motif={spec.sprig} x={oval ? 33 : 29} y={H / 2} k={1.15} />}
				<text x={tx} y={H / 2 - 9} textAnchor="middle" fill="currentColor" style={text(fit(spec.top ?? "", 8.6, 20))}>
					{spec.top}
				</text>
				<text x={tx} y={H / 2 + 7.5} textAnchor="middle" fill="currentColor" style={display(fit(main, 18, 10))}>
					{main}
				</text>
				<text x={tx} y={H / 2 + 19.5} textAnchor="middle" fill="currentColor" style={text(7.4, 500)}>
					{spec.date}
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
