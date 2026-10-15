/**
 * Security print ("Sicherheitsdruck") for the Laufzettel identity, drawn on <canvas>.
 * Pure drawing functions, no React. Used by Band in Brand.tsx.
 *
 *   drawBand   the fine wavy band at the head of every document (like on passports and banknotes)
 *
 * See docs/DESIGN.md ("Patterns").
 */

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
