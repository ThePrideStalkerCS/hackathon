/**
 * Hold to submit: press and hold until the ring is full (about one second). A deliberate act
 * instead of an accidental tap, and it makes "only you can submit" tangible.
 *
 * Works with mouse, touch and keyboard (hold Space or Enter). Letting go early cancels.
 * 👉 EXTEND HERE: a setting "submit with one tap" for people who can't hold a button.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons";

const HOLD_MS = 1100;

type Props = { label: string; hint: string; disabled?: boolean; busy?: boolean; busyLabel?: string; onConfirm: () => void };

export function HoldToConfirm({ label, hint, disabled, busy, busyLabel, onConfirm }: Props) {
	const [progress, setProgress] = useState(0);
	const start = useRef<number | null>(null);
	const frame = useRef(0);
	const done = useRef(false);

	function begin() {
		if (disabled || busy || start.current !== null) return;
		done.current = false;
		start.current = performance.now();
		const tick = (now: number) => {
			if (start.current === null) return;
			const p = Math.min(1, (now - start.current) / HOLD_MS);
			setProgress(p);
			if (p >= 1) {
				done.current = true;
				start.current = null;
				onConfirm();
				return;
			}
			frame.current = requestAnimationFrame(tick);
		};
		frame.current = requestAnimationFrame(tick);
	}

	function cancel() {
		cancelAnimationFrame(frame.current);
		start.current = null;
		if (!done.current) setProgress(0);
	}

	useEffect(() => () => cancelAnimationFrame(frame.current), []);

	const r = 26;
	const c = 2 * Math.PI * r;
	return (
		<div className={`hold ${disabled ? "is-disabled" : ""} ${progress > 0 ? "is-holding" : ""}`}>
			<button
				type="button"
				className="hold-button"
				disabled={disabled || busy}
				aria-describedby="hold-hint"
				onPointerDown={(e) => {
					try {
						e.currentTarget.setPointerCapture(e.pointerId); // keep holding even if the finger slides a bit
					} catch {
						// not available for this pointer: holding still works
					}
					begin();
				}}
				onPointerUp={cancel}
				onPointerCancel={cancel}
				onKeyDown={(e) => {
					if ((e.key === " " || e.key === "Enter") && !e.repeat) {
						e.preventDefault();
						begin();
					}
				}}
				onKeyUp={(e) => (e.key === " " || e.key === "Enter") && cancel()}
				onContextMenu={(e) => e.preventDefault()}
			>
				<svg viewBox="0 0 60 60" aria-hidden="true">
					<circle className="hold-track" cx="30" cy="30" r={r} />
					<circle className="hold-fill" cx="30" cy="30" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
				</svg>
				<span className="hold-icon">
					<Icon name="fingerprint" size={30} strokeWidth={1.8} />
				</span>
				<span className="visually-hidden">{label}</span>
			</button>
			<span className="hold-label">{busy ? busyLabel : label}</span>
			<span id="hold-hint" className="hold-hint">
				{hint}
			</span>
		</div>
	);
}
