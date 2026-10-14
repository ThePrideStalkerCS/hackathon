/**
 * The citizen's seal: press and hold until the red ring is full (about one second) to sign and submit.
 * A deliberate act instead of an accidental tap, and it makes "only you can submit" tangible.
 * The AI has no submit tool; this button (via the `submit` callable) is the only way. See docs/CORE.md.
 *
 * Mouse, touch and keyboard (hold Space or Enter). Letting go early cancels.
 * 👉 EXTEND HERE: a setting "sign with one tap" for people who can't hold a button.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";

const HOLD_MS = 1100;

type Props = { initials: string; label: string; hint: string; disabled?: boolean; busy?: boolean; busyLabel: string; onConfirm: () => void };

export function HoldSeal({ initials, label, hint, disabled, busy, busyLabel, onConfirm }: Props) {
	const [progress, setProgress] = useState(0);
	const start = useRef<number | null>(null);
	const frame = useRef(0);

	function begin() {
		if (disabled || busy || start.current !== null) return;
		start.current = performance.now();
		const tick = (now: number) => {
			if (start.current === null) return;
			const p = Math.min(1, (now - start.current) / HOLD_MS);
			setProgress(p);
			if (p >= 1) {
				start.current = null;
				onConfirm();
				return;
			}
			frame.current = requestAnimationFrame(tick);
		};
		frame.current = requestAnimationFrame(tick);
	}

	function cancel() {
		if (start.current === null) return;
		cancelAnimationFrame(frame.current);
		start.current = null;
		setProgress(0);
	}

	useEffect(() => () => cancelAnimationFrame(frame.current), []);

	return (
		<div className="lz-hold-wrap">
			<button
				type="button"
				className="lz-hold"
				style={{ "--p": busy ? 1 : progress } as CSSProperties}
				disabled={disabled || busy}
				aria-label={`${label}. ${hint}`}
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
				<span>
					<b>{initials}</b>
					{busy ? busyLabel : label}
				</span>
			</button>
		</div>
	);
}
