/**
 * Page 3: one goal as a step-by-step progress bar (e.g. the driving licence). Route: #/goals/<id>
 */
import { tpl } from "../i18n";
import { percent, type Goal } from "./data";
import { Bot, GoalIcon, ProgressBar, type Common } from "./shared";

export function GoalDetail({ goal, t, lang, progress, go, onToggle }: Common & { goal: Goal; onToggle: (stepId: string) => void }) {
	const done = progress[goal.id] ?? [];
	const pct = percent(goal, done);
	const currentIndex = goal.steps.findIndex((s) => !done.includes(s.id));
	const current = goal.steps[currentIndex];

	return (
		<section className="goals-page">
			<button type="button" className="link-button" onClick={() => go("#/goals")}>
				← {t.goalsAll}
			</button>
			<h2 className="goal-title">
				<GoalIcon name={goal.icon} /> {goal.name[lang]}
			</h2>

			<div className="goal-summary">
				<ProgressBar value={pct} label={goal.name[lang]} />
				<strong className="goal-pct">{pct} %</strong>
			</div>

			<Bot>{current ? tpl(t.goalsNextStep, { step: current.title[lang], left: goal.steps.length - done.length }) : t.goalsAllStepsDone}</Bot>

			<h3>{t.portalRequirements}</h3>
			<ol className="goal-steps">
				{goal.steps.map((s, i) => {
					const isDone = done.includes(s.id);
					const state = isDone ? "done" : i === currentIndex ? "current" : "todo";
					return (
						<li key={s.id} className={`goal-step ${state}`} aria-current={state === "current" ? "step" : undefined}>
							<span className="goal-step-dot" aria-hidden="true">
								{isDone ? "✓" : i + 1}
							</span>
							<div className="goal-step-body">
								<h4>{s.title[lang]}</h4>
								<p>{s.hint[lang]}</p>
								<p className="fine-print">
									{isDone ? `✓ ${t.goalsDone}` : state === "current" ? `▶ ${t.goalsNow}` : t.goalsLater} · {s.who === "system" ? t.goalsWhoSystem : t.goalsWhoCitizen}
								</p>
							</div>
							<button type="button" aria-pressed={isDone} onClick={() => onToggle(s.id)}>
								{isDone ? t.goalsUndo : t.goalsMarkDone}
							</button>
						</li>
					);
				})}
			</ol>

			{pct === 100 && (
				<button type="button" className="primary big" onClick={() => go(`#/goals/${goal.id}/done`)}>
					{t.goalsCollect}
				</button>
			)}

			<p className="fine-print">
				{t.factsUnverified}{" "}
				<a href={goal.sourceUrl} target="_blank" rel="noreferrer">
					{t.source}: oesterreich.gv.at
				</a>
			</p>
		</section>
	);
}
