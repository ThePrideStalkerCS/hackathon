/**
 * The emblem: the citizen's seal for one errand, drawn like an engraved stamp.
 *
 *   Motif     one engraved vignette per life event (motifs.ts, motifFor below)
 *               move      → stone pine (Zirbe) on a rocky ridge, mountains behind
 *               passport  → peaks with an ibex, the Danube running towards you
 *               child     → edelweiss with a bud
 *             the 48 px slip head gets a solid silhouette of the same scene
 *   Wreath    one leaf per station, two branches growing up from the bottom; a leaf is inked
 *             when its station is stamped
 *   Edge      an uneven, hand-pressed ring; the slip number sits small at the bottom
 *
 * Shows real progress only: no points, no levels, nothing compared with other people.
 */
import { useId, type CSSProperties } from "react";
import { motifFor, motifLayers, SCENE_R, type Motif } from "./motifs";

export { motifFor };
export type { Motif };


const R_EDGE = 93;
const R_WREATH = 77;
/** The wreath is two branches that start at the bottom (where the serial sits) and meet at the top. */
const WREATH_GAP = 26;

function wreathStem(r: number) {
	const a0 = ((90 - WREATH_GAP + 8) * Math.PI) / 180;
	const a1 = ((90 + WREATH_GAP - 8) * Math.PI) / 180;
	return `M${(r * Math.cos(a0)).toFixed(2)},${(r * Math.sin(a0)).toFixed(2)}A${r},${r} 0 1 0 ${(r * Math.cos(a1)).toFixed(2)},${(r * Math.sin(a1)).toFixed(2)}`;
}

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

const LEAF = "M0,0 C5,-5.5 14,-5.5 20,0 C14,5.5 5,5.5 0,0Z";

type EmblemProps = {
	motif: Motif;
	done: number;
	total: number;
	/** Accessible description, e.g. "Seal: 3 of 7 stations stamped". */
	label: string;
	/** Slip number, set small at the bottom of the edge. */
	serial?: string;
	size?: "xs" | "sm" | "md" | "lg";
	className?: string;
};

const LAYER_CLASS = { ink: "em-solid", paper: "em-paper", line: "em-line", fine: "em-fine" } as const;

function Engraving({ motif, cut }: { motif: Motif; cut: "full" | "silhouette" }) {
	return (
		<>
			{motifLayers(motif, cut).map((l, i) => (
				<path key={i} d={l.d} className={LAYER_CLASS[l.c]} />
			))}
		</>
	);
}

export function Emblem({ motif, done, total, label, serial = "", size = "lg", className = "" }: EmblemProps) {
	const uid = `em${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const n = Math.max(total, 1);
	const complete = done >= n;
	const small = size === "xs";

	return (
		<span className={`lz-emblem is-${size} ${complete ? "is-complete" : ""} ${className}`} role="img" aria-label={label}>
			<svg viewBox="-100 -100 200 200" aria-hidden="true">
				<defs>
					<clipPath id={`${uid}s`}>
						<circle r={SCENE_R} />
					</clipPath>
					<path id={`${uid}b`} d="M-40,74 A84,84 0 0 0 40,74" />
				</defs>
				<path d={wobblyCircle(R_EDGE, 1)} className="em-edge" />
				<path d={wreathStem(R_WREATH)} className="em-fine em-stem" />
				{Array.from({ length: n }, (_, i) => {
					const side = i % 2 ? 1 : -1;
					const k = Math.floor(i / 2);
					const per = Math.ceil(n / 2);
					const a = 90 + side * (WREATH_GAP + ((k + 0.5) * (180 - WREATH_GAP)) / per);
					const rad = (a * Math.PI) / 180;
					const tilt = side < 0 ? a + 90 + (k % 2 ? 20 : -20) : a - 90 + 180 + (k % 2 ? -20 : 20);
					return (
						<path
							key={i}
							d={LEAF}
							transform={`translate(${(R_WREATH * Math.cos(rad)).toFixed(2)},${(R_WREATH * Math.sin(rad)).toFixed(2)}) rotate(${tilt.toFixed(1)}) translate(-10,0)`}
							className={`em-leaf ${i < done ? "is-inked" : ""}`}
							style={{ "--i": i } as CSSProperties}
						/>
					);
				})}
				<circle r={SCENE_R + 1.6} className="em-line em-frame" />
				<g clipPath={`url(#${uid}s)`} className="em-motif">
					<Engraving motif={motif} cut={small ? "silhouette" : "full"} />
				</g>
				{serial && !small && size !== "sm" && (
					<text className="em-serial">
						<textPath href={`#${uid}b`} startOffset="50%" textAnchor="middle">
							{serial}
						</textPath>
					</text>
				)}
			</svg>
		</span>
	);
}
