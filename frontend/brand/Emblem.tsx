/**
 * The emblem: the citizen's seal for one errand, drawn like an engraved stamp.
 *
 *   Motif     one figurative motif per life event, fine-line engraving (motifFor below)
 *               move      → stone pine (Zirbe) with new roots
 *               passport  → mountains above the Danube
 *               child     → edelweiss
 *   Wreath    one leaf per station of the slip; a leaf is inked when the station is stamped
 *   Edge      an uneven, hand-pressed ring with microtext (slip number and errand)
 *
 * Shows real progress only: no points, no levels, nothing compared with other people.
 * Strokes do not scale, so the same drawing works at 44 px (slip head) and 260 px (confirmation).
 */
import { useId, type CSSProperties, type ReactNode } from "react";

export type Motif = "pine" | "peaks" | "edelweiss";

export function motifFor(serviceId: string): Motif {
	if (serviceId === "passport-renewal") return "peaks";
	if (serviceId === "childcare-subsidy") return "edelweiss";
	return "pine";
}

const R_EDGE = 93;
const R_WREATH = 70;

/** Deterministic "hand-pressed" circle: a few slow waves on the radius. */
function wobblyCircle(r: number, seed = 0): string {
	const pts: string[] = [];
	const n = 72;
	for (let i = 0; i <= n; i++) {
		const a = (i / n) * Math.PI * 2;
		const rr = r + 1.3 * Math.sin(5 * a + seed) + 0.8 * Math.sin(11 * a + seed * 2) + 0.5 * Math.sin(17 * a);
		pts.push(`${(rr * Math.cos(a)).toFixed(2)},${(rr * Math.sin(a)).toFixed(2)}`);
	}
	return `M${pts.join("L")}Z`;
}

/** A soft scalloped blob (pine crown clump). */
function clump(cx: number, cy: number, rx: number, ry: number, bumps = 7): string {
	const pts: string[] = [];
	const n = 60;
	for (let i = 0; i <= n; i++) {
		const a = (i / n) * Math.PI * 2;
		const k = 1 + 0.1 * Math.abs(Math.sin((bumps * a) / 2));
		pts.push(`${(cx + rx * k * Math.cos(a)).toFixed(2)},${(cy + ry * k * Math.sin(a)).toFixed(2)}`);
	}
	return `M${pts.join("L")}Z`;
}

function hatch(id: string, clip: string, spacing: number, angle = 0, from = -60, to = 60): ReactNode {
	const lines = [];
	for (let y = from; y <= to; y += spacing) lines.push(<path key={y} d={`M-70,${y}H70`} />);
	return (
		<>
			<clipPath id={id}>
				<path d={clip} />
			</clipPath>
			<g clipPath={`url(#${id})`}>
				<g transform={`rotate(${angle})`} className="em-fine">
					{lines}
				</g>
			</g>
		</>
	);
}

const PETAL = "M0,-7 C8,-18 8,-38 0,-50 C-8,-38 -8,-18 0,-7Z";

function Edelweiss() {
	return (
		<g>
			{Array.from({ length: 9 }, (_, i) => (
				<g key={i} transform={`rotate(${i * 40})`}>
					<path d={PETAL} className="em-line" />
					<path d="M0,-11V-45" className="em-fine" />
					<path d="M-3.4,-19 0,-23 3.4,-19M-4,-28 0,-32 4,-28M-3,-37 0,-40.5 3,-37" className="em-fine" />
				</g>
			))}
			{Array.from({ length: 9 }, (_, i) => (
				<path key={`s${i}`} d={PETAL} transform={`rotate(${i * 40 + 20}) scale(.52)`} className="em-line em-paper" />
			))}
			{[
				[0, 0],
				...Array.from({ length: 6 }, (_, i) => [8.6 * Math.cos((i * Math.PI) / 3), 8.6 * Math.sin((i * Math.PI) / 3)]),
			].map(([x, y], i) => (
				<g key={`f${i}`}>
					<circle cx={x} cy={y} r="4.3" className="em-line em-paper" />
					<circle cx={x} cy={y} r="1.1" className="em-dot" />
				</g>
			))}
		</g>
	);
}

function Pine({ uid }: { uid: string }) {
	const clumps = [
		clump(-25, -6, 17, 8.5),
		clump(24, -12, 18, 9),
		clump(-13, -24, 16, 9),
		clump(11, -30, 16, 9.5),
		clump(-1, -43, 12, 8),
		clump(-33, 8, 11, 6, 5),
		clump(32, 4, 11, 6, 5),
	];
	return (
		<g>
			<path d="M-48,34 C-30,30 -12,36 0,33 C14,30 30,35 48,32" className="em-line" />
			<path d="M-40,40 C-26,37 -14,41 -2,39M8,40 C20,37 32,41 42,39" className="em-fine" />
			<path d="M-2,31 C-7,38 -17,42 -28,44M2,31 C7,37 17,41 26,45M0,32 C1,38 -2,43 1,49M-1,34 C-10,36 -12,40 -20,40" className="em-line" />
			<path d="M-4,32 C-5,18 -2,4 -4,-16M4,32 C3,18 5,4 3,-16" className="em-line" />
			<path d="M-1,28 C0,18 -1,8 0,-6M-2.5,22 C-2,14 -3,6 -2,0" className="em-fine" />
			<path d="M-3,6 C-12,2 -20,-1 -30,2M3,-1 C12,-5 20,-9 30,-6M-3,-10 C-8,-15 -12,-19 -16,-26M3,-14 C7,-20 10,-25 12,-30" className="em-line" />
			{clumps.map((d, i) => (
				<g key={i}>
					<path d={d} className="em-line em-paper" />
					{hatch(`${uid}c${i}`, d, 2.6, -8)}
				</g>
			))}
			<ellipse cx="-6" cy="-35" rx="3" ry="4.2" className="em-line em-paper" />
			<path d="M-8.5,-36 -3.5,-34M-8.5,-33 -3.5,-31" className="em-fine" />
			<ellipse cx="17" cy="-22" rx="3" ry="4.2" className="em-line em-paper" />
			<path d="M14.5,-23 19.5,-21M14.5,-20 19.5,-18" className="em-fine" />
		</g>
	);
}

function Peaks({ uid }: { uid: string }) {
	const range = "M-52,24 L-26,-12 L-16,-3 L2,-36 L20,-8 L29,-17 L52,24Z";
	const back = "M-52,24 L-38,2 L-30,8 L-14,-18 L4,8 L26,-26 L40,-6 L52,6 L52,24Z";
	return (
		<g>
			<circle cx="27" cy="-38" r="9" className="em-line" />
			<path d="M15,-38H39M17,-34H37M17,-42H37M20,-46H34M20,-30H34" className="em-fine" />
			<path d={back} className="em-fine" />
			{hatch(`${uid}b`, back, 4.2, 0)}
			<path d={range} className="em-line em-paper" />
			{hatch(`${uid}r`, range, 2.7, -28)}
			<path d="M-5,-27 2,-36 10,-24 6,-22 2,-26 -1,-21Z" className="em-solid" />
			<path d="M-30,-7 -26,-12 -21,-7.5 -24,-6.5 -26,-9 -28,-5Z" className="em-solid" />
			<path d="M-46,32 C-34,28 -22,35 -8,31 S22,27 46,32" className="em-line" />
			<path d="M-40,38 C-28,35 -18,40 -4,37 S20,34 40,38M-30,44 C-20,42 -10,45 2,43 S18,41 30,44" className="em-fine" />
		</g>
	);
}

function MotifDrawing({ motif, uid }: { motif: Motif; uid: string }) {
	if (motif === "edelweiss") return <Edelweiss />;
	if (motif === "peaks") return <Peaks uid={uid} />;
	return <Pine uid={uid} />;
}

const LEAF = "M0,0 C5,-5.5 14,-5.5 20,0 C14,5.5 5,5.5 0,0Z";

type EmblemProps = {
	motif: Motif;
	done: number;
	total: number;
	/** Accessible description, e.g. "Seal: 3 of 7 stations stamped". */
	label: string;
	/** Microtext around the edge (slip number, errand). */
	micro?: string;
	size?: "xs" | "sm" | "md" | "lg";
	className?: string;
};

export function Emblem({ motif, done, total, label, micro = "", size = "lg", className = "" }: EmblemProps) {
	const uid = `em${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const n = Math.max(total, 1);
	const share = Math.min(done / n, 1);
	const complete = done >= n;
	const text = micro ? `${micro} · `.repeat(Math.max(1, Math.ceil(70 / micro.length))).toUpperCase() : "";

	return (
		<span
			className={`lz-emblem is-${size} ${complete ? "is-complete" : ""} ${className}`}
			role="img"
			aria-label={label}
			style={{ "--ink-share": share.toFixed(2) } as CSSProperties}
		>
			<svg viewBox="-100 -100 200 200" aria-hidden="true">
				<defs>
					<path id={`${uid}m`} d={`M0,${-81}a81,81 0 1 1 0,162a81,81 0 1 1 0,-162`} />
				</defs>
				<path d={wobblyCircle(R_EDGE, 1)} className="em-edge" />
				<path d={wobblyCircle(R_EDGE - 6, 2)} className="em-fine" />
				{text && size !== "xs" && (
					<text className="em-micro">
						<textPath href={`#${uid}m`} textLength={2 * Math.PI * 81 - 4} lengthAdjust="spacing">
							{text}
						</textPath>
					</text>
				)}
				<circle r={R_WREATH} className="em-fine em-stem" />
				{Array.from({ length: n }, (_, i) => {
					const a = -90 + (i * 360) / n;
					const rad = (a * Math.PI) / 180;
					return (
						<path
							key={i}
							d={LEAF}
							transform={`translate(${(R_WREATH * Math.cos(rad)).toFixed(2)},${(R_WREATH * Math.sin(rad)).toFixed(2)}) rotate(${a + 90 - 18})`}
							className={`em-leaf ${i < done ? "is-inked" : ""}`}
							style={{ "--i": i } as CSSProperties}
						/>
					);
				})}
				<g className="em-motif">
					<MotifDrawing motif={motif} uid={uid} />
				</g>
			</svg>
		</span>
	);
}
