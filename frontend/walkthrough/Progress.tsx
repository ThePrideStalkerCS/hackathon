/**
 * Video-style progress bar under the top bar: one thin segment per step, grouped into chapters
 * (like YouTube chapters). Tap a segment you have already reached to jump back to it.
 */
import { CHAPTERS, type Walkthrough } from "../../src/shared/walkthrough";
import { tpl, type UIText } from "../i18n";

export function Progress({ w, t, onGoTo }: { w: Walkthrough; t: UIText; onGoTo: (index: number) => void }) {
	const locked = Boolean(w.result) || w.status === "blocked";
	const reachable = (i: number) => !locked && (i <= w.current || w.steps.slice(0, i).every((s) => s.done));

	return (
		<nav className="progress" aria-label={tpl(t.stepOf, { n: w.current + 1, total: w.steps.length })}>
			<ol>
				{CHAPTERS.map((chapter) => {
					const indexes = w.steps.map((s, i) => (s.chapter === chapter ? i : -1)).filter((i) => i >= 0);
					if (!indexes.length) return null;
					const active = indexes.includes(w.current);
					return (
						<li key={chapter} className={active ? "is-current" : ""} style={{ flexGrow: indexes.length }}>
							<div className="segments">
								{indexes.map((i) => (
									<button
										key={i}
										type="button"
										className={`segment ${w.steps[i].done || i < w.current ? "done" : ""} ${i === w.current ? "current" : ""}`}
										title={w.steps[i].title}
										aria-label={`${i + 1}. ${w.steps[i].title}`}
										aria-current={i === w.current ? "step" : undefined}
										disabled={!reachable(i)}
										onClick={() => onGoTo(i)}
									/>
								))}
							</div>
							<span className="chapter-label">{t.chapters[chapter]}</span>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
