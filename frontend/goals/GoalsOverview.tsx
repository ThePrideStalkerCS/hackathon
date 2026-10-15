/**
 * Page 1: the bot shows 5 progress bars, one per errand. Route: #/goals
 */
import { tpl } from "../i18n";
import { GOALS, percent } from "./data";
import { Bot, GoalIcon, ProgressBar, type Common } from "./shared";

export function GoalsOverview({ t, lang, progress, go, onReset }: Common & { onReset: () => void }) {
	const nearest = GOALS.filter((g) => percent(g, progress[g.id] ?? []) < 100).sort((a, b) => percent(b, progress[b.id] ?? []) - percent(a, progress[a.id] ?? []))[0];
	return (
		<section className="goals-page">
			<h2>{t.goalsTitle}</h2>
			<Bot>{nearest ? tpl(t.goalsBot, { goal: nearest.name[lang], pct: percent(nearest, progress[nearest.id] ?? []) }) : t.goalsBotAllDone}</Bot>

			<ul className="goal-list">
				{GOALS.map((g) => {
					const done = progress[g.id] ?? [];
					const pct = percent(g, done);
					return (
						<li key={g.id} className={pct === 100 ? "goal-card complete" : "goal-card"}>
							<GoalIcon name={g.icon} />
							<div className="goal-body">
								<div className="goal-head">
									<h3>{g.name[lang]}</h3>
									<strong className="goal-pct">{pct} %</strong>
								</div>
								<ProgressBar value={pct} label={g.name[lang]} />
								<p className="fine-print">{tpl(t.goalsStepsDone, { n: done.filter((id) => g.steps.some((s) => s.id === id)).length, total: g.steps.length })}</p>
							</div>
							<button type="button" className={g === nearest ? "primary" : ""} onClick={() => go(pct === 100 ? `#/goals/${g.id}/done` : `#/goals/${g.id}`)}>
								{pct === 100 ? t.goalsSeeSticker : `${t.goalsOpen} →`}
							</button>
						</li>
					);
				})}
			</ul>

			<div className="goal-footer">
				<button type="button" className="link-button" onClick={() => go("")}>
					← {t.backToStart}
				</button>
				<button type="button" className="link-button" onClick={onReset}>
					{t.goalsReset}
				</button>
			</div>
		</section>
	);
}
