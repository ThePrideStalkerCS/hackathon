/**
 * Engraving toolkit for the emblem motifs (Emblem.tsx). Pure geometry: every function returns SVG
 * path data, the same input always gives the same drawing.
 *
 *   swell       a filled line that swells and tapers, like a burin cut (SVG strokes cannot do that)
 *   hatchShape  lines across a shape that follow its form: bowed, thin on the light side,
 *               thick on the shadow side
 *   blob        an organic closed outline (crown, bract, rock) from a few slow waves on an ellipse
 */
export type Pt = [number, number];

const f = (n: number) => n.toFixed(2);

export function pathOf(points: Pt[], close = true): string {
	return `M${points.map((p) => `${f(p[0])},${f(p[1])}`).join("L")}${close ? "Z" : ""}`;
}

/** Deterministic pseudo-random numbers in 0..1. */
export function rand(seed: number) {
	let x = seed % 233280;
	return () => {
		x = (x * 9301 + 49297) % 233280;
		return x / 233280;
	};
}

/** Width profile that is 0 at both ends and 1 in the middle. */
export const taper = (t: number) => Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.55);

/** A filled, swelling line along `points`; `width(t)` gives the full width at t in 0..1. */
export function swell(points: Pt[], width: (t: number) => number): string {
	const n = points.length;
	if (n < 2) return "";
	const left: Pt[] = [];
	const right: Pt[] = [];
	for (let i = 0; i < n; i++) {
		const a = points[Math.max(0, i - 1)];
		const b = points[Math.min(n - 1, i + 1)];
		let dx = b[0] - a[0];
		let dy = b[1] - a[1];
		const len = Math.hypot(dx, dy) || 1;
		dx /= len;
		dy /= len;
		const w = width(i / (n - 1)) / 2;
		left.push([points[i][0] - dy * w, points[i][1] + dx * w]);
		right.push([points[i][0] + dy * w, points[i][1] - dx * w]);
	}
	return pathOf([...left, ...right.reverse()]);
}

/** Quadratic curve sampled into points (for swell). */
export function curve(a: Pt, c: Pt, b: Pt, steps = 14): Pt[] {
	return Array.from({ length: steps + 1 }, (_, i) => {
		const t = i / steps;
		const u = 1 - t;
		return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
	});
}

/** Organic closed outline: an ellipse whose radius moves with a few waves. */
export function blob(cx: number, cy: number, rx: number, ry: number, waves: [number, number, number][], n = 140): Pt[] {
	return Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2;
		const k = 1 + waves.reduce((s, [amp, freq, phase]) => s + amp * Math.sin(freq * a + phase), 0);
		return [cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)];
	});
}

function rotate([x, y]: Pt, deg: number): Pt {
	const r = (deg * Math.PI) / 180;
	return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
}

/** Where a horizontal line at y crosses a closed polygon (even-odd pairs). */
export function spans(poly: Pt[], y: number): [number, number][] {
	const xs: number[] = [];
	for (let i = 0; i < poly.length; i++) {
		const [x1, y1] = poly[i];
		const [x2, y2] = poly[(i + 1) % poly.length];
		if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
	}
	xs.sort((a, b) => a - b);
	const out: [number, number][] = [];
	for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
	return out;
}

export type HatchOptions = {
	spacing: number;
	/** Thinnest and thickest line width. */
	wMin: number;
	wMax: number;
	/** Lines bow down in the middle by this much (follows a rounded form); 0 = straight. */
	bow?: number;
	/** Hatch direction in degrees (0 = horizontal). */
	angle?: number;
	/** Light comes from this side; lines get thick towards the other side. */
	light?: "left" | "right";
	/** Lines also get thicker towards the bottom of the shape (underside in shadow). */
	under?: number;
	/** Skip every line with this probability (hand-cut irregularity). */
	gaps?: number;
	seed?: number;
};

/** Form-following engraved hatching inside `poly`. Returns one path with all lines as filled shapes. */
export function hatchShape(poly: Pt[], o: HatchOptions): string {
	const angle = o.angle ?? 0;
	const local = poly.map((p) => rotate(p, -angle));
	const ys = local.map((p) => p[1]);
	const top = Math.min(...ys);
	const bottom = Math.max(...ys);
	const r = rand(o.seed ?? 7);
	const out: string[] = [];
	for (let y = top + o.spacing / 2; y < bottom; y += o.spacing) {
		if (o.gaps && r() < o.gaps) continue;
		const v = (y - top) / (bottom - top || 1);
		for (const [xa, xb] of spans(local, y)) {
			if (xb - xa < 1.2) continue;
			const steps = Math.max(4, Math.round((xb - xa) / 2.2));
			const pts: Pt[] = [];
			for (let i = 0; i <= steps; i++) {
				const t = i / steps;
				const u = t * 2 - 1;
				const x = xa + (xb - xa) * t;
				pts.push(rotate([x, y + (o.bow ?? 0) * (1 - u * u)], angle));
			}
			const under = 1 + (o.under ?? 0) * (v - 0.5);
			out.push(
				swell(pts, (t) => {
					const s = o.light === "right" ? 1 - t : t;
					const ends = Math.min(1, t / 0.1, (1 - t) / 0.1);
					return (o.wMin + (o.wMax - o.wMin) * Math.pow(s, 1.6)) * under * Math.sqrt(Math.max(0, ends));
				}),
			);
		}
	}
	return out.join("");
}

/** Short tapered strokes along an outline, pointing outwards (needles, felt, grass). */
export function fringe(poly: Pt[], o: { every: number; length: [number, number]; width: number; seed: number; only?: (p: Pt) => boolean; tilt?: number }): string {
	const r = rand(o.seed);
	const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
	const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
	const out: string[] = [];
	for (let i = 0; i < poly.length; i += o.every) {
		const p = poly[i];
		if (o.only && !o.only(p)) continue;
		const base = Math.atan2(p[1] - cy, p[0] - cx) + (o.tilt ?? 0) + (r() - 0.5) * 0.7;
		const len = o.length[0] + r() * (o.length[1] - o.length[0]);
		const start: Pt = [p[0] - Math.cos(base) * len * 0.35, p[1] - Math.sin(base) * len * 0.35];
		const end: Pt = [p[0] + Math.cos(base) * len * 0.65, p[1] + Math.sin(base) * len * 0.65];
		out.push(swell([start, [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2], end], (t) => o.width * (1 - t * 0.85)));
	}
	return out.join("");
}
