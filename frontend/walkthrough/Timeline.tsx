/**
 * Video-player style controls under the portal: chapters with step markers (like YouTube
 * chapters), play/pause, back/next, speed and voice. The citizen sets the pace, not the machine.
 */
import { CHAPTERS, type Walkthrough } from "../../src/shared/walkthrough";
import type { UIText } from "../i18n";

type Props = {
	w: Walkthrough;
	t: UIText;
	playing: boolean;
	rate: number;
	voiceOn: boolean;
	onTogglePlay: () => void;
	onBack: () => void;
	onNext: () => void;
	onGoTo: (index: number) => void;
	onRate: (rate: number) => void;
	onToggleVoice: () => void;
};

export function Timeline(p: Props) {
	const { w, t } = p;
	const step = w.steps[w.current];
	const locked = Boolean(w.result) || w.status === "blocked";
	const canNext = !locked && step && (!step.waitsForCitizen || step.done) && step.kind !== "review" && step.kind !== "done";
	const reachable = (i: number) => !locked && (i <= w.current || w.steps.slice(0, i).every((s) => s.done));

	return (
		<div className="timeline">
			<ol className="chapters" aria-label="Kapitel">
				{CHAPTERS.map((chapter) => {
					const indexes = w.steps.map((s, i) => (s.chapter === chapter ? i : -1)).filter((i) => i >= 0);
					if (!indexes.length) return null;
					const active = indexes.includes(w.current);
					return (
						<li key={chapter} className={`chapter ${active ? "is-current-chapter" : ""}`} style={{ flexGrow: indexes.length }}>
							<div className="ticks">
								{indexes.map((i) => (
									<button
										key={i}
										type="button"
										className={`tick ${w.steps[i].done ? "done" : ""} ${i === w.current ? "current" : ""}`}
										aria-label={`${i + 1}: ${w.steps[i].title}`}
										aria-current={i === w.current ? "step" : undefined}
										disabled={!reachable(i)}
										onClick={() => p.onGoTo(i)}
									/>
								))}
							</div>
							<span className="chapter-label">{t.chapters[chapter]}</span>
						</li>
					);
				})}
			</ol>

			<div className="player-controls">
				<button type="button" onClick={p.onBack} disabled={locked || w.current === 0} aria-label={t.back}>
					⏮ <span className="hide-sm">{t.back}</span>
				</button>
				<button type="button" className="primary" onClick={p.onTogglePlay} aria-pressed={p.playing}>
					{p.playing ? `⏸ ${t.pause}` : `▶ ${t.play}`}
				</button>
				<button type="button" onClick={p.onNext} disabled={!canNext} aria-label={t.next}>
					<span className="hide-sm">{t.next}</span> ⏭
				</button>
				<label className="speed">
					{t.speed}
					<select value={p.rate} onChange={(e) => p.onRate(Number(e.target.value))}>
						<option value={0.8}>0.8×</option>
						<option value={1}>1×</option>
						<option value={1.2}>1.2×</option>
					</select>
				</label>
				<button type="button" onClick={p.onToggleVoice} aria-pressed={p.voiceOn}>
					{p.voiceOn ? `🔊 ${t.voiceOn}` : `🔇 ${t.voiceOff}`}
				</button>
			</div>
		</div>
	);
}
