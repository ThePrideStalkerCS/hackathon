/**
 * Security print ("Sicherheitsdruck") for the Laufzettel identity, drawn on <canvas>.
 * Pure drawing functions, no React. Used by Seal and Band in Brand.tsx.
 *
 *   drawSeal   the reward: a guilloche rosette with one ring per station; done rings are red
 *   drawBand   the fine wavy band at the head of every document (like on passports and banknotes)
 *
 * See docs/redesign/LAUFZETTEL.md ("The seal").
 */

const RED = "rgba(200,16,46,.88)";
const PENDING = "rgba(140,146,168,.4)";

/** Sizes the canvas to its CSS box (sharp on retina screens) and returns a cleared 2D context. */
export function prepare(canvas: HTMLCanvasElement) {
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	const box = canvas.getBoundingClientRect();
	const w = Math.max(1, box.width);
	const h = Math.max(1, box.height);
	canvas.width = Math.round(w * dpr);
	canvas.height = Math.round(h * dpr);
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, w, h);
	return { ctx, w, h };
}

/** One closed wavy ring: radius r, wave amplitude a, n waves around, shifted by phase. */
function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a: number, n: number, phase: number) {
	const steps = Math.min(2600, Math.max(360, Math.round(r * 5)));
	ctx.beginPath();
	for (let i = 0; i <= steps; i++) {
		const t = (i / steps) * Math.PI * 2;
		const rr = r + a * Math.sin(n * t + phase);
		const x = cx + rr * Math.cos(t);
		const y = cy + rr * Math.sin(t);
		if (i) ctx.lineTo(x, y);
		else ctx.moveTo(x, y);
	}
	ctx.stroke();
}

/** The seal: `total` rings, the first `done` of them red. The middle stays white for the count. */
export function drawSeal(canvas: HTMLCanvasElement, done: number, total: number) {
	const p = prepare(canvas);
	if (!p || total < 1) return;
	const { ctx, w, h } = p;
	const cx = w / 2;
	const cy = h / 2;
	const size = Math.min(w, h) / 2;
	const big = size > 80;
	const inner = size * (big ? 0.46 : 0.52);
	const outer = size * 0.9;
	const band = (outer - inner) / total;

	for (let k = 0; k < total; k++) {
		const on = k < done;
		ctx.strokeStyle = on ? RED : PENDING;
		ctx.lineWidth = on ? (big ? 0.6 : 0.5) : 0.45;
		const r = inner + band * (k + 0.5);
		const n = (big ? 12 : 8) + k * (big ? 4 : 3);
		for (let pass = 0; pass < 3; pass++) ring(ctx, cx, cy, r, band * 0.8, n, (pass * Math.PI * 2) / 3);
	}

	// Coin edge: fine ticks, red when the seal is complete.
	ctx.lineWidth = 0.8;
	ctx.strokeStyle = done >= total ? "rgba(200,16,46,.95)" : "rgba(18,21,42,.5)";
	const ticks = big ? 120 : 72;
	for (let i = 0; i < ticks; i++) {
		const a = (i / ticks) * Math.PI * 2;
		const r1 = size * 0.945;
		const r2 = size * (i % 6 ? 0.975 : 1);
		ctx.beginPath();
		ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
		ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
		ctx.stroke();
	}

	ctx.fillStyle = "#FFFFFF";
	ctx.beginPath();
	ctx.arc(cx, cy, inner - 3, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = "rgba(18,21,42,.85)";
	ctx.lineWidth = 1;
	ctx.stroke();
}

/** The guilloche band: two families of interwoven waves across the full width. */
export function drawBand(canvas: HTMLCanvasElement, color = "rgba(200,16,46,.55)") {
	const p = prepare(canvas);
	if (!p) return;
	const { ctx, w, h } = p;
	const mid = h / 2;
	ctx.strokeStyle = color;
	ctx.lineWidth = 0.6;
	for (let fam = 0; fam < 2; fam++) {
		const lambda = fam ? 44 : 29;
		for (let pass = 0; pass < 6; pass++) {
			ctx.beginPath();
			for (let x = 0; x <= w; x += 1.5) {
				const env = 0.55 + 0.45 * Math.sin(x / (fam ? 130 : 90) + pass * 0.35);
				const y = mid + h * 0.4 * env * Math.sin((2 * Math.PI * x) / lambda + (pass * Math.PI) / 3 + (fam * Math.PI) / 4);
				if (x) ctx.lineTo(x, y);
				else ctx.moveTo(x, y);
			}
			ctx.stroke();
		}
	}
}
