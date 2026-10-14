/**
 * Page 2: shown when a bar reaches 100 %. A calm completion confirmation plus an overview of all
 * completion records ("badges") earned so far. Route: #/goals/<id>/done
 */
import { tpl } from "../i18n";
import { GOALS, percent, type Goal } from "./data";
import { Bot, GoalIcon, ProgressBar, type Common } from "./shared";

export function GoalCelebration({ goal, t, lang, progress, go }: Common & { goal: Goal }) {
	const earned = GOALS.filter((g) => percent(g, progress[g.id] ?? []) === 100);
	const next = GOALS.find((g) => percent(g, progress[g.id] ?? []) < 100);

	return (
		<section className="goals-page celebration">
			<div className="completion-card">
				<div className="completion-seal" aria-hidden="true">
					<GoalIcon name={goal.icon} className="completion-seal-icon" />
					<span className="completion-seal-check">✓</span>
				</div>
				<div>
					<p className="completion-kicker">{t.goalsCongrats}</p>
					<h2>{goal.badge[lang]}</h2>
					<p className="lead">{tpl(t.goalsCongratsText, { goal: goal.name[lang] })}</p>
				</div>
				<ProgressBar value={100} label={goal.name[lang]} />
			</div>

			<h3>{tpl(t.goalsCollection, { n: earned.length, total: GOALS.length })}</h3>
			<ul className="badge-grid">
				{GOALS.map((g) => {
					const has = earned.includes(g);
					const pct = percent(g, progress[g.id] ?? []);
					return (
						<li key={g.id} className={has ? "badge earned" : "badge open"}>
							<GoalIcon name={g.icon} className="badge-icon" />
							<span className="badge-label">{has ? g.badge[lang] : g.name[lang]}</span>
							<span className="badge-status">{has ? `✓ ${t.goalsDone}` : tpl(t.goalsOpenPct, { pct })}</span>
						</li>
					);
				})}
			</ul>

			<Bot>{next ? tpl(t.goalsCelebrateNext, { goal: next.name[lang] }) : t.goalsBotAllDone}</Bot>

			<div className="goal-footer">
				{next && (
					<button type="button" className="primary big" onClick={() => go(`#/goals/${next.id}`)}>
						{tpl(t.upNext, { name: next.name[lang] })} →
					</button>
				)}
				<button type="button" className="big" onClick={() => go("#/goals")}>
					{t.goalsAll}
				</button>
			</div>
		</section>
	);
}
