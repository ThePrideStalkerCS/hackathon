/**
 * The emblem motifs, engraved (geometry from engrave.ts). Each motif is a vignette inside a circle
 * of radius SCENE_R and comes in two cuts:
 *
 *   full        hatching that follows the form, swelling lines, a few solid ink shadows (sm and up)
 *   silhouette  the same scene as a few solid shapes, for the 48 px slip head
 *
 * Layers are computed once per motif and cached; the drawing never changes between renders.
 */
import { blob, curve, fringe, hatchShape, pathOf, rand, spans, swell, taper, type Pt } from "./engrave";

export type Motif = "pine" | "peaks" | "edelweiss";

export const SCENE_R = 61;

/** ink = filled with the stamp colour, paper = knocks out what lies below, line/fine = strokes. */
export type Layer = { d: string; c: "ink" | "paper" | "line" | "fine" };

class Plate {
	layers: Layer[] = [];
	ink(d: string) {
		if (d) this.layers.push({ d, c: "ink" });
	}
	paper(d: string) {
		this.layers.push({ d, c: "paper" });
	}
	line(d: string) {
		this.layers.push({ d, c: "line" });
	}
	fine(d: string) {
		this.layers.push({ d, c: "fine" });
	}
}

/** Indices of `poly` whose angle around (cx, cy) lies between a0 and a1 (degrees, y down). */
function arc(poly: Pt[], cx: number, cy: number, a0: number, a1: number): Pt[] {
	const pick = poly
		.map((p) => ({ p, a: ((Math.atan2(p[1] - cy, p[0] - cx) * 180) / Math.PI + 360) % 360 }))
		.filter(({ a }) => (a0 <= a1 ? a >= a0 && a <= a1 : a >= a0 || a <= a1))
		.sort((x, y) => {
			const nx = (x.a - a0 + 360) % 360;
			const ny = (y.a - a0 + 360) % 360;
			return nx - ny;
		});
	return pick.map(({ p }) => p);
}

/** A domed pad of needles: round top in the light, flatter underside. */
function pad(cx: number, cy: number, rx: number, ryTop: number, ryBot: number, seed: number): Pt[] {
	const r = rand(seed);
	const p1 = r() * 6;
	const p2 = r() * 6;
	const n = 96;
	return Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2;
		const s = Math.sin(a);
		const k = 1 + 0.07 * Math.sin(6 * a + p1) + 0.04 * Math.sin(13 * a + p2);
		const ry = s > 0 ? ryBot : ryTop;
		return [cx + rx * k * Math.cos(a), cy + ry * k * s];
	});
}

/** Draws one needle pad: knock-out, form hatching, a swelling shadow contour below, needles on top.
 *  `dark` darkens the whole pad (the crown is lit from the left, its right side lies in shadow). */
function needlePad(pl: Plate, [cx, cy, rx, ryT, ryB]: number[], seed: number, dark: number) {
	const p = pad(cx, cy, rx, ryT, ryB, seed);
	pl.paper(pathOf(p));
	pl.ink(
		hatchShape(p, {
			spacing: 1.35,
			wMin: 0.24 + 0.3 * dark,
			wMax: 1.05 + 0.85 * dark,
			bow: ryT * 0.4,
			light: "left",
			under: 1.1,
			seed,
			gaps: 0.05,
		}),
	);
	const lower = arc(p, cx, cy, 345, 178);
	pl.ink(swell(lower, (t) => 0.3 + (1.5 + 1.4 * dark) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.2)), 1.2)));
	pl.ink(
		fringe(p, {
			every: 3,
			length: [1.8, 3.6],
			width: 0.5,
			seed: seed + 11,
			only: (q) => q[1] < cy - ryT * 0.15,
		}),
	);
}

/** Needle pads laid over the crown in rows, each row offset and jittered like real growth. */
function padsFor(crown: Pt[], seed: number): number[][] {
	const r = rand(seed);
	const ys = crown.map((p) => p[1]);
	const top = Math.min(...ys);
	const bottom = Math.max(...ys);
	const out: number[][] = [];
	let row = 0;
	for (let y = top + 5.5; y < bottom - 2; y += 5.6, row++) {
		const sp = spans(crown, y)[0];
		if (!sp) continue;
		const [xa, xb] = sp;
		const w = xb - xa;
		const count = Math.max(1, Math.round(w / 12.5));
		const step = w / count;
		for (let i = 0; i < count; i++) {
			const rx = Math.min(step * 0.62 + 1.6 + r() * 1.6, 11);
			const cx = xa + step * (i + 0.5) + (r() - 0.5) * 3 + (row % 2 ? 1.6 : -1.6);
			out.push([cx, y + (r() - 0.5) * 2, rx, 4.6 + r() * 1.6, 2.8 + r() * 0.8]);
		}
	}
	return out;
}

function pine(): { full: Layer[]; silhouette: Layer[] } {
	const pl = new Plate();

	const far: Pt[] = [
		[-66, 34], [-66, 8], [-58, 2], [-50, -6], [-43, -15], [-38, -10], [-33, -13], [-27, -3], [-18, -7], [-8, 3], [6, -4],
		[15, -9], [23, -16], [33, -25], [37, -21], [41, -23], [47, -13], [54, -7], [60, -4], [66, -5], [66, 34],
	];
	pl.paper(pathOf(far));
	pl.ink(hatchShape(far, { spacing: 1.9, wMin: 0.12, wMax: 0.3, light: "left", seed: 3 }));
	const shadowFace: Pt[] = [[33, -25], [37, -21], [41, -23], [47, -13], [54, -7], [60, -4], [66, -5], [66, 34], [22, 34], [27, 8], [30, -8], [31.5, -18]];
	pl.paper(pathOf(shadowFace));
	pl.ink(hatchShape(shadowFace, { spacing: 1.45, wMin: 0.22, wMax: 0.62, angle: 64, light: "left", seed: 5, under: 0.4 }));
	const leftFace: Pt[] = [[-43, -15], [-38, -10], [-33, -13], [-27, -3], [-31, 14], [-39, 8]];
	pl.paper(pathOf(leftFace));
	pl.ink(hatchShape(leftFace, { spacing: 1.4, wMin: 0.3, wMax: 0.8, angle: 62, light: "left", seed: 9 }));
	const snow: Pt[][] = [
		[[33, -25], [37, -21], [36, -18.6], [34, -20.4], [32.4, -17], [30.6, -18.8], [28.8, -15], [28, -17.2], [30.6, -21.4]],
		[[-43, -15], [-40, -11.5], [-41.2, -10.2], [-42.8, -11.8], [-44.6, -9.8], [-46, -11.2], [-47.6, -9.6], [-45.4, -13]],
	];
	for (const s of snow) pl.paper(pathOf(s));
	pl.fine(pathOf(far.slice(1, -1), false));

	const ridge: Pt[] = [
		[-66, 39], [-56, 36], [-46, 33.5], [-36, 31], [-26, 29.6], [-16, 28.2], [-8, 27.2], [2, 27.4], [10, 28.6], [17, 31], [25, 33.4],
		[35, 36.4], [45, 38.6], [55, 41.6], [66, 43], [66, 66], [-66, 66],
	];
	pl.paper(pathOf(ridge));
	pl.ink(hatchShape(ridge, { spacing: 1.8, wMin: 0.25, wMax: 1.25, angle: -28, light: "left", under: 0.7, seed: 21, gaps: 0.05 }));
	const strata: [Pt, Pt, Pt, number][] = [
		[[-58, 42], [-44, 39], [-30, 41], 1.6],
		[[-24, 36], [-12, 33], [2, 35], 2.2],
		[[8, 37], [20, 37], [32, 42], 1.8],
		[[-46, 50], [-30, 47], [-14, 50], 1.4],
		[[4, 48], [18, 47], [34, 52], 1.6],
		[[38, 44], [48, 44], [60, 48], 1.2],
	];
	for (const [a, c, b, w] of strata) pl.ink(swell(curve(a, c, b), (t) => w * taper(t)));
	pl.ink(swell(curve([-16, 28.6], [-2, 31.5], [14, 30]), (t) => 2.6 * taper(t)));
	pl.line(pathOf(ridge.slice(0, -2), false));

	const tufts: string[] = [];
	const r = rand(41);
	for (const [x, y] of [[-40, 32], [-28, 30], [18, 31.4], [26, 33.6], [40, 37.6], [-52, 35]] as Pt[]) {
		for (let i = 0; i < 6; i++) {
			const a = -Math.PI / 2 + (r() - 0.5) * 1.6;
			const len = 1.8 + r() * 2.6;
			tufts.push(swell([[x + i * 0.7 - 2, y], [x + i * 0.7 - 2 + Math.cos(a) * len, y + Math.sin(a) * len]], (t) => 0.55 * (1 - t)));
		}
	}
	pl.ink(tufts.join(""));

	const trunkL: Pt[] = [[-3.6, 4], [-3.9, 12], [-4.4, 19], [-5.8, 24.5], [-9.5, 28.2], [-14, 29.4]];
	const trunkR: Pt[] = [[2.8, 4], [3.1, 12], [3.8, 19], [5.4, 24.5], [9, 28.4], [13, 30]];
	const trunk = [...trunkL, ...trunkR.slice().reverse()];
	pl.paper(pathOf(trunk));
	const bark: string[] = [];
	for (let i = 0; i < 7; i++) {
		const u = i / 6;
		const pts = trunkL.slice(0, 5).map(([x, y], k): Pt => {
			const xr = trunkR[k][0];
			return [x + (xr - x) * (0.12 + u * 0.78) + Math.sin(k * 1.7 + i) * 0.35, y];
		});
		bark.push(swell(pts, (t) => (0.2 + 1.05 * Math.pow(u, 1.5)) * Math.min(1, t / 0.08, (1 - t) / 0.12)));
	}
	pl.ink(bark.join(""));
	pl.ink(swell(trunkR.slice(), (t) => 0.6 + 1.6 * taper(t)));
	pl.ink(swell(trunkL.slice(), (t) => 0.3 + 0.5 * taper(t)));
	pl.ink(swell(curve([-6, 26], [-16, 29], [-24, 33]), (t) => 1.4 * (1 - t)));
	pl.ink(swell(curve([5, 26], [16, 30], [22, 35]), (t) => 1.6 * (1 - t)));
	pl.ink(swell(curve([-4, 15], [-16, 13], [-25, 8.5]), (t) => 1.7 * (1 - t * 0.8)));
	pl.ink(swell(curve([-19, 11.4], [-23, 7], [-24, 2.4]), (t) => 0.9 * (1 - t * 0.7)));
	pl.ink(swell(curve([-25, 8.5], [-29, 8], [-31, 5]), (t) => 0.8 * (1 - t * 0.7)));

	const crown = blob(-2.5, -20, 22, 31, [[0.045, 7, 0.4], [0.03, 12, 1.3], [0.02, 19, 2.1]]).map(([x, y]): Pt => {
		const h = Math.max(0, (-20 - y) / 31);
		return [-2.5 + (x + 2.5) * (1 - 0.32 * h * h), y];
	});
	pl.ink(pathOf(crown));
	padsFor(crown, 7).forEach((p, i) => needlePad(pl, p, 101 + i * 17, Math.min(1, Math.max(0, (p[0] + 14) / 30))));
	const cones: Pt[] = [[-12.5, -36.5], [9, -27], [-3, -16.8]];
	for (const [x, y] of cones) {
		const c = blob(x, y, 2, 2.7, [[0.05, 5, 0]], 24);
		pl.paper(pathOf(c));
		pl.ink(hatchShape(c, { spacing: 0.9, wMin: 0.15, wMax: 0.5, angle: 30, light: "left", seed: 3 }));
		pl.ink(swell(arc(c, x, y, 330, 160), (t) => 0.3 + 0.7 * taper(t)));
	}

	return { full: pl.layers, silhouette: youngPine() };
}

/** One tier of a conifer: concave flanks from the apex, branch tips hanging lower than the middle. */
function tier(cx: number, top: number, bottom: number, hw: number, droop: number): Pt[] {
	const n = 16;
	const flank = (side: 1 | -1, t: number): Pt => [cx + side * hw * Math.pow(t, 1.4), top + (bottom - top) * t];
	const right = Array.from({ length: n + 1 }, (_, i) => flank(1, i / n));
	const under = Array.from({ length: n - 1 }, (_, i): Pt => {
		const u = 1 - (2 * (i + 1)) / n;
		return [cx + hw * u, bottom - droop * (1 - u * u)];
	});
	const left = Array.from({ length: n + 1 }, (_, i) => flank(-1, 1 - i / n));
	return [...right, ...under, ...left];
}

/** The 48 px cut: a young Zirbe is still conical, so the silhouette is a pointed, tiered crown on a
 *  trunk that stands clear of the ground. Nothing round on top, nothing to either side: at this size
 *  a round crown over a mountain line reads as a head and shoulders. */
function youngPine(): Layer[] {
	const sil = new Plate();
	sil.ink(pathOf([[-66, 37], [-40, 34.6], [-16, 33.2], [0, 32.8], [16, 33.4], [40, 35.2], [66, 38], [66, 66], [-66, 66]]));
	sil.ink(pathOf([[-3, 6], [3, 6], [3.6, 26], [5, 31], [8.5, 34], [-8.5, 34], [-5, 31], [-3.6, 26]]));
	sil.ink(pathOf(tier(0, -19, 17, 28, 5.5)));
	sil.ink(pathOf(tier(0, -36, -4, 20.5, 4.5)));
	sil.ink(pathOf(tier(0, -51, -24, 12.5, 3.2)));
	return sil.layers;
}

/** Alpine ibex (Steinbock), facing left, feet at 0,0. */
const IBEX =
	"M-9,-6L-9,0L-7.8,0L-7.6,-5L-5.5,-5L-5.2,0L-4,0L-4.2,-5.5C-1,-6 3,-6 5,-6L5.4,0L6.6,0L7,-5.5L8.2,0L9.4,0L9.4,-7C10,-9 10,-11 8.6,-12C4,-12.5 -3,-12.5 -7,-12L-9,-15C-10,-16 -12,-16.5 -13.5,-15.6L-15.6,-13.2C-15.4,-12.2 -14.2,-12.2 -13,-12.8L-12.6,-11L-12,-9.2L-11,-10.6C-10.6,-8.5 -10,-7 -9,-6Z";
const HORN = "M-11.6,-16.2 C-10.4,-22.4 -4,-25.6 0.8,-20.6 C-3.4,-22.8 -8.8,-20.8 -10.2,-15.6Z";

/** Moves an SVG path made of absolute coordinates only (M L C Z). */
function place(d: string, dx: number, dy: number, k: number): string {
	return d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, x, y) => `${(dx + Number(x) * k).toFixed(2)},${(dy + Number(y) * k).toFixed(2)}`);
}

function peaks(): { full: Layer[]; silhouette: Layer[] } {
	const pl = new Plate();
	const sky: Pt[] = [[-64, -64], [64, -64], [64, 14], [-64, 14]];
	pl.ink(hatchShape(sky, { spacing: 2.1, wMin: 0.26, wMax: 0.34, seed: 2 }));
	const sun = blob(-33, -31, 9.5, 9.5, [], 60);
	pl.paper(pathOf(sun));
	pl.fine(pathOf(sun));

	const massif: Pt[] = [
		[-66, 22], [-58, 12], [-50, 5], [-42, -5], [-35, -1], [-25, -15], [-15, -25], [-6, -36], [1, -29], [7, -31], [14, -21],
		[21, -13], [26, -17], [30.6, -23.2], [37.4, -23.6], [39.4, -16], [46, -9], [56, -1], [66, 3], [66, 32], [-66, 32],
	];
	pl.paper(pathOf(massif));
	pl.ink(hatchShape(massif, { spacing: 1.8, wMin: 0.14, wMax: 0.5, angle: -6, light: "left", under: 0.6, seed: 4 }));
	const faces: Pt[][] = [
		[[-6, -36], [1, -29], [7, -31], [14, -21], [21, -13], [17, 6], [7, 12], [4, -6], [-1, -21]],
		[[37.4, -23.6], [39.4, -16], [46, -9], [56, -1], [66, 3], [66, 32], [30, 32], [29, 10], [32, -6], [33.4, -19]],
		[[-42, -5], [-35, -1], [-25, -15], [-28, 6], [-36, 12]],
	];
	faces.forEach((f, i) => {
		pl.paper(pathOf(f));
		pl.ink(hatchShape(f, { spacing: 1.3, wMin: 0.3, wMax: 1.05, angle: 62, light: "left", under: 0.5, seed: 8 + i }));
	});
	const snow: Pt[][] = [
		[[-6, -36], [1, -29], [-1.4, -26.4], [-3, -28.6], [-4.6, -23.6], [-7.6, -27], [-10.6, -21.8], [-13, -24.4], [-11, -29]],
		[[37.4, -23.6], [38.8, -19], [36.8, -18], [35, -20], [33, -17], [31, -19.4], [30.6, -23.2]],
	];
	for (const sn of snow) pl.paper(pathOf(sn));
	pl.ink(swell(curve([-6, -36], [-3, -18], [6, 11]), (t) => 0.3 + 1.6 * taper(t)));
	pl.ink(swell(curve([34.6, -21], [30, -6], [29.6, 18]), (t) => 0.3 + 1.4 * taper(t)));
	pl.ink(swell(curve([-25, -15], [-27, -4], [-30, 9]), (t) => 0.3 + 1.1 * taper(t)));
	pl.line(pathOf(massif.slice(0, -2), false));
	pl.ink(place(IBEX, 34, -23.5, 0.62));
	pl.ink(place(HORN, 34, -23.5, 0.62));

	const left: Pt[] = [[-66, 30], [-48, 23], [-28, 25], [-10, 30], [-4, 36], [-14, 45], [-28, 66], [-66, 66]];
	const right: Pt[] = [[6, 32], [22, 26], [42, 25], [66, 27], [66, 66], [26, 66], [13, 49], [17, 40]];
	const river: Pt[] = [[-28, 66], [26, 66], [13, 49], [17, 40], [6, 32], [-1, 29.4], [-10, 30], [-4, 36], [-14, 45]];
	pl.paper(pathOf(river));
	const waves: string[] = [];
	const r = rand(77);
	for (let y = 32; y < 64; y += 2.3) {
		for (const [xa, xb] of spans(river, y)) {
			const w = xb - xa;
			let x = xa + 1 + r() * 2;
			while (x < xb - 2) {
				const len = Math.min(xb - 1 - x, 2.5 + r() * w * 0.25);
				waves.push(swell([[x, y], [x + len / 2, y + 0.2], [x + len, y]], (t) => (0.3 + (y - 30) / 70) * taper(t)));
				x += len + 1.5 + r() * 3;
			}
		}
	}
	pl.ink(waves.join(""));
	for (const [bank, seed, light] of [[left, 13, "left"], [right, 17, "right"]] as const) {
		pl.paper(pathOf(bank));
		pl.ink(hatchShape(bank, { spacing: 1.5, wMin: 0.35, wMax: 1.25, angle: light === "left" ? -14 : 12, light, under: 0.7, bow: -1.2, seed }));
	}
	const trees: string[] = [];
	for (const [x, y, k] of [[-56, 26.4, 1], [-50, 24.6, 0.8], [-38, 23.6, 1.1], [-31, 24.8, 0.9], [26, 25.4, 1], [33, 24.6, 0.8], [50, 25.4, 1.1], [57, 26.4, 0.9]] as const) {
		trees.push(pathOf([[x - 2 * k, y + 0.6], [x, y - 6 * k], [x + 2 * k, y + 0.6]]));
	}
	pl.ink(trees.join(""));
	pl.ink(swell(curve([-10, 30], [-6, 34], [-14, 45]), (t) => 0.4 + 1.6 * taper(t)));
	pl.ink(swell(curve([6, 32], [19, 38], [13, 49]), (t) => 0.4 + 1.6 * taper(t)));

	const sil = new Plate();
	sil.line(pathOf(sun));
	sil.ink(pathOf(massif));
	sil.paper(pathOf(snow[0]));
	sil.ink(place(IBEX, 34.2, -23.4, 0.9));
	sil.ink(place(HORN, 34.2, -23.4, 0.9));
	// One ground with the river as a thin line widening towards you: a broad white river at this
	// size reads as a mouth under the sun and the snow.
	sil.ink(pathOf([[-66, 30], [-48, 23], [-28, 25], [-10, 30], [-1, 29.4], [6, 32], [22, 26], [42, 25], [66, 27], [66, 66], [-66, 66]]));
	sil.paper(swell([...curve([3, 25], [-8, 33], [0, 44]), ...curve([0, 44], [9, 53], [2, 66]).slice(1)], (t) => 0.6 + 7 * t * t));
	return { full: pl.layers, silhouette: sil.layers };
}

/** A lance-shaped bract or leaf from `base` towards `angle` (degrees), slightly curled. */
function lance(base: Pt, angle: number, len: number, width: number, curl: number, n = 26): { poly: Pt[]; axis: Pt[] } {
	const left: Pt[] = [];
	const right: Pt[] = [];
	const axis: Pt[] = [];
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		const a = ((angle + curl * t * t) * Math.PI) / 180;
		const ax: Pt = [base[0] + Math.cos(a) * len * t, base[1] + Math.sin(a) * len * t];
		const w = (width / 2) * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85);
		axis.push(ax);
		left.push([ax[0] - Math.sin(a) * w, ax[1] + Math.cos(a) * w]);
		right.push([ax[0] + Math.sin(a) * w, ax[1] - Math.cos(a) * w]);
	}
	return { poly: [...left, ...right.slice(1, -1).reverse()], axis };
}

/** Felted bract: knock-out, the half away from the light finely hatched along the bract, woolly outline. */
function felt(pl: Plate, base: Pt, angle: number, len: number, width: number, curl: number, seed: number, shade = 1) {
	const { poly, axis } = lance(base, angle, len, width, curl);
	pl.paper(pathOf(poly));
	const a = (angle * Math.PI) / 180;
	const shadeLeft = -Math.sin(a) * -0.7 + Math.cos(a) * -0.7 < 0;
	const n = axis.length;
	const half = shadeLeft ? poly.slice(0, n) : [poly[0], ...poly.slice(n).reverse(), poly[n - 1]];
	const dark = [...half, ...axis.slice().reverse()];
	pl.ink(hatchShape(dark, { spacing: 1.05, wMin: 0.18, wMax: 0.62 * shade, angle: angle + 90, seed, gaps: 0.1 }));
	pl.ink(swell(axis.slice(3, -4), (t) => 0.5 * taper(t)));
	pl.ink(swell(half.slice(1, -1), (t) => 0.2 + 0.55 * taper(t)));
	pl.ink(fringe(poly, { every: 1, length: [0.5, 1.3], width: 0.34, seed }));
}

/** The floret cluster: small domes, densely stippled, darker towards the lower right. */
function florets(pl: Plate, heads: Pt[], r0: number, seed: number) {
	const r = rand(seed);
	const dots: string[] = [];
	for (const [x, y] of heads) {
		const h = blob(x, y, r0, r0 * 0.94, [[0.06, 5, x]], 30);
		pl.paper(pathOf(h));
		pl.ink(swell(arc(h, x, y, 330, 165), (t) => 0.35 + 0.95 * taper(t)));
		for (let i = 0; i < 26; i++) {
			const a = r() * Math.PI * 2;
			const d = Math.sqrt(r()) * r0 * 0.82;
			const px = x + Math.cos(a) * d;
			const py = y + Math.sin(a) * d;
			const lit = (px - x - (py - y)) / (r0 * 1.4);
			if (r() > 0.4 + lit * 0.5) dots.push(pathOf(blob(px, py, 0.4, 0.4, [], 7)));
		}
	}
	pl.ink(dots.join(""));
}

function edelweiss(): { full: Layer[]; silhouette: Layer[] } {
	const pl = new Plate();
	const far: Pt[] = [[-66, 14], [-54, 6], [-44, 9], [-33, 0], [-22, 8], [-8, 4], [8, 10], [22, -2], [34, 5], [48, -1], [66, 8], [66, 66], [-66, 66]];
	const ridgeLine = far.slice(0, -2);
	// An engraved sky, darker towards the top, so the white bracts stand out against ink.
	const sky: Pt[] = [[-66, -66], [66, -66], ...ridgeLine.slice().reverse()];
	pl.ink(hatchShape(sky, { spacing: 1.6, wMin: 0.3, wMax: 0.42, under: -0.9, seed: 2 }));
	pl.paper(pathOf(far));
	pl.ink(hatchShape(far, { spacing: 1.35, wMin: 0.32, wMax: 0.95, angle: 58, light: "left", under: 0.4, seed: 5 }));
	pl.line(pathOf(ridgeLine, false));
	const rock: Pt[] = [[-66, 42], [-50, 36], [-36, 38], [-20, 33], [-6, 37], [8, 34], [22, 39], [36, 35], [50, 40], [66, 38], [66, 66], [-66, 66]];
	pl.paper(pathOf(rock));
	pl.ink(hatchShape(rock, { spacing: 1.6, wMin: 0.3, wMax: 1.15, angle: -24, light: "left", under: 0.8, seed: 9, gaps: 0.05 }));
	for (const [a, c, b, w] of [
		[[-58, 46], [-46, 43], [-34, 46], 1.4],
		[[-16, 42], [-4, 40], [8, 43], 1.8],
		[[20, 46], [34, 43], [48, 47], 1.6],
	] as [Pt, Pt, Pt, number][])
		pl.ink(swell(curve(a, c, b), (t) => w * taper(t)));
	pl.line(pathOf(rock.slice(0, -2), false));

	pl.ink(swell(curve([-6, -8], [4, 16], [0, 44]), (t) => 3.3 - 1.1 * t));
	pl.ink(swell(curve([30, 6], [22, 28], [2, 40]), (t) => 2 - 0.6 * t));
	const leaves: [Pt, number, number, number, number][] = [
		[[2.6, 14], 198, 18, 5.4, -22],
		[[3.6, 22], -16, 20, 5.6, 22],
		[[2.2, 31], 194, 15, 5, -16],
		[[18, 27], -36, 12, 4.2, 18],
	];
	leaves.forEach(([b, a, l, w, c], i) => felt(pl, b, a, l, w, c, 300 + i, 1.4));

	const bud: Pt = [30, 4];
	[-96, -44, 4, 52, 104, 150, 200, 250].forEach((a, i) => felt(pl, bud, a, 9 + (i % 3) * 1.6, 5.2, i % 2 ? 8 : -8, 400 + i));
	florets(pl, [[30, 4], [32.4, 2.2], [28, 2], [29.6, 6.6]], 2.1, 61);

	const centre: Pt = [-6, -16];
	const bracts = [
		[-100, 28, 12], [-62, 25, 11.4], [-24, 30, 12.6], [14, 26, 11.6], [50, 28, 12.2], [90, 22, 10.8],
		[126, 27, 11.8], [164, 24, 11.4], [202, 29, 12.4], [240, 21, 10.8],
	];
	bracts.forEach(([a, l, w], i) => felt(pl, centre, a, l, w, i % 2 ? 12 : -10, 200 + i));
	florets(pl, [[-6, -16], [-0.6, -19], [-10.8, -19.6], [-11.4, -12.2], [-5.4, -10.2], [0.2, -12.8], [-6.4, -22.4]], 3.5, 55);

	const sil = new Plate();
	sil.ink(pathOf(rock));
	sil.ink(swell(curve([-6, -8], [4, 16], [0, 44]), (t) => 5 - 1.4 * t));
	sil.ink(swell(curve([30, 6], [22, 28], [2, 40]), (t) => 3 - 0.8 * t));
	for (const a of [-90, -30, 30, 90, 150, 210]) sil.ink(pathOf(lance(bud, a, 9.5, 5.6, 0).poly));
	for (const [b, a, l, w, c] of leaves) sil.ink(pathOf(lance(b, a, l, w * 1.3, c).poly));
	for (const [a, l, w] of bracts) sil.ink(pathOf(lance(centre, a, l, w * 1.1, 0).poly));
	sil.paper(pathOf(blob(-6, -16, 9, 9, [[0.08, 6, 0]], 40)));
	sil.ink(pathOf(blob(-6, -16, 4.4, 4.4, [[0.1, 5, 0]], 30)));
	return { full: pl.layers, silhouette: sil.layers };
}

export function motifFor(serviceId: string): Motif {
	if (serviceId === "passport-renewal") return "peaks";
	if (serviceId === "childcare-subsidy") return "edelweiss";
	return "pine";
}

/** A small sprig of the motif for office stamps (about 24 units, centred on 0,0). */
function sprig(motif: Motif): Layer[] {
	const pl = new Plate();
	if (motif === "pine") {
		const twig = curve([-10, 11], [-3, 2], [9, -10], 20);
		pl.ink(swell(twig, (t) => 1.7 * (1 - t * 0.55)));
		const needles: string[] = [];
		for (const [k, spread] of [[0.35, 1.1], [0.62, 1], [0.86, 0.9], [1, 0.75]] as const) {
			const [x, y] = twig[Math.round(k * (twig.length - 1))];
			for (let i = 0; i < 7; i++) {
				const a = -Math.PI / 2 + 0.25 + (i - 3) * 0.36 * spread;
				const len = 7.4 - Math.abs(i - 3) * 0.6;
				needles.push(swell([[x, y], [x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5], [x + Math.cos(a) * len, y + Math.sin(a) * len]], (t) => 0.85 * (1 - t * 0.8)));
			}
		}
		pl.ink(needles.join(""));
		const cone = blob(-4.6, 9.6, 2.6, 3.4, [[0.05, 5, 0]], 24);
		pl.ink(pathOf(cone));
		pl.paper(swell(curve([-6.4, 8], [-4.6, 9.4], [-2.8, 8]), () => 0.5) + swell(curve([-6.6, 10.8], [-4.6, 12.2], [-2.6, 10.8]), () => 0.5));
	} else if (motif === "peaks") {
		const hill: Pt[] = [[-12, 9], [-5.5, -2], [-2.6, 1.4], [3.6, -9], [12, 9]];
		pl.ink(hatchShape(hill, { spacing: 1.25, wMin: 0.3, wMax: 0.75, angle: 60, light: "left", seed: 4 }));
		pl.ink(swell(hill, () => 1.1));
		pl.paper(pathOf([[3.6, -9], [6.2, -4.4], [4.6, -5], [3.4, -3.6], [2, -5.2], [1.4, -4.6]]));
		const sun = blob(-7.4, -7.4, 2.6, 2.6, [], 20);
		pl.ink(swell([...sun, sun[0]], () => 0.8));
	} else {
		const centre: Pt = [0, -1.5];
		for (let i = 0; i < 7; i++) {
			const a = -90 + i * (360 / 7) + (i % 2 ? 6 : -6);
			pl.ink(pathOf(lance(centre, a, i % 2 ? 8.6 : 10, 4.2, i % 2 ? 8 : -8, 14).poly));
		}
		pl.paper(pathOf(blob(0, -1.5, 3.4, 3.4, [[0.1, 5, 0]], 24)));
		pl.ink(pathOf(blob(0, -1.5, 1.1, 1.1, [], 10)) + pathOf(blob(-1.9, -0.2, 0.7, 0.7, [], 8)) + pathOf(blob(1.8, -0.4, 0.7, 0.7, [], 8)));
		pl.ink(swell(curve([0.4, 6], [1.6, 9.6], [0.4, 12.6]), () => 1));
	}
	return pl.layers;
}

const sprigs = new Map<Motif, Layer[]>();

export function sprigLayers(motif: Motif): Layer[] {
	let s = sprigs.get(motif);
	if (!s) {
		s = sprig(motif);
		sprigs.set(motif, s);
	}
	return s;
}

const DRAW = { pine, peaks, edelweiss };
const cache = new Map<Motif, { full: Layer[]; silhouette: Layer[] }>();

export function motifLayers(motif: Motif, cut: "full" | "silhouette"): Layer[] {
	let m = cache.get(motif);
	if (!m) {
		m = DRAW[motif]();
		cache.set(motif, m);
	}
	return m[cut];
}
