/**
 * The sound of a stamp landing on paper: a soft low thump plus a short paper slap, made with Web Audio
 * (no audio file). Played once per stamp while the offices fill the slip; it marks an event, like the
 * stamp's press animation. Quiet next to the narration, and only when the voice is switched on.
 */
let ctx: AudioContext | null = null;

export function stampSound(delaySeconds = 0.18) {
	try {
		ctx ??= new AudioContext();
		if (ctx.state === "suspended") void ctx.resume();
		const t = ctx.currentTime + delaySeconds;

		// the body of the stamp
		const osc = ctx.createOscillator();
		osc.type = "sine";
		osc.frequency.setValueAtTime(150, t);
		osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
		const body = ctx.createGain();
		body.gain.setValueAtTime(0.0001, t);
		body.gain.exponentialRampToValueAtTime(0.3, t + 0.005);
		body.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
		osc.connect(body).connect(ctx.destination);
		osc.start(t);
		osc.stop(t + 0.2);

		// the paper
		const length = Math.floor(ctx.sampleRate * 0.05);
		const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
		const noise = ctx.createBufferSource();
		noise.buffer = buffer;
		const band = ctx.createBiquadFilter();
		band.type = "bandpass";
		band.frequency.value = 1800;
		const paper = ctx.createGain();
		paper.gain.value = 0.1;
		noise.connect(band).connect(paper).connect(ctx.destination);
		noise.start(t);
	} catch {
		// no Web Audio (old browser, blocked): the stamp still lands visually
	}
}
