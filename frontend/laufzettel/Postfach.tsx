/**
 * The digital Postfach (mailbox) and its letters.
 *
 *   MailboxButton  in the top bar, with the number of unread letters
 *   LetterToast    a quiet note when a letter arrives; the slip keeps running underneath
 *   LetterSheet    the letter: the original (German, as the office wrote it) next to what it means in
 *                  plain words, by when to act, what happens if nothing is done, what to do if it is
 *                  wrong, and what it has to do with the errand in progress. Paying is the citizen's tap.
 *
 * Demo story: during Lena's registration a parking fine arrives (src/gov/data/mail.ts).
 */
import { useEffect, useRef } from "react";
import type { Letter } from "../../src/shared/mail";
import type { Language } from "../../src/shared/types";
import { Band, Stamp } from "../brand/Brand";
import { Icon } from "../icons";
import { tpl, type UIText } from "../i18n";
import { stampDate } from "./stations";

export function euro(amount: number, lang: Language): string {
	return new Intl.NumberFormat(lang === "de" ? "de-AT" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

export function longDate(iso: string, lang: Language): string {
	return new Intl.DateTimeFormat(lang === "de" ? "de-AT" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

export function MailboxButton({ t, unread, onOpen }: { t: UIText; unread: number; onOpen: () => void }) {
	const label = unread ? `${t.lzMailbox}, ${tpl(t.lzMailboxUnread, { n: unread })}` : t.lzMailbox;
	return (
		<button type="button" className={`lz-top-link lz-mailbox ${unread ? "has-unread" : ""}`} onClick={onOpen} aria-label={label} title={label}>
			<Icon name="mail" size={20} />
			<span>{t.lzMailbox}</span>
			{unread > 0 && (
				<b className="lz-badge" aria-hidden="true">
					{unread}
				</b>
			)}
		</button>
	);
}

export function LetterToast({ t, letter, onOpen, onLater }: { t: UIText; letter: Letter; onOpen: () => void; onLater: () => void }) {
	return (
		<div className="lz-toast" role="status">
			<Icon name="mail" size={22} />
			<div className="lz-toast-text">
				<span className="lz-toast-kicker">{t.lzNewLetter}</span>
				<strong>{letter.title}</strong>
				<span className="lz-toast-from">{letter.from}</span>
			</div>
			<div className="lz-toast-actions">
				<button type="button" className="lz-btn is-primary is-small" onClick={onOpen}>
					{t.lzOpenLetter}
				</button>
				<button type="button" className="lz-btn is-ghost is-small" onClick={onLater}>
					{t.lzLater}
				</button>
			</div>
		</div>
	);
}

type SheetProps = { t: UIText; lang: Language; letter: Letter; paid: boolean; onPay: () => void; onClose: () => void; onHuman: () => void };

export function LetterSheet({ t, lang, letter, paid, onPay, onClose, onHuman }: SheetProps) {
	const closeRef = useRef<HTMLButtonElement>(null);
	const amount = euro(letter.amountEur, lang);

	// Focus moves into the dialog; Escape closes it.
	useEffect(() => {
		closeRef.current?.focus();
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div className="lz-letter-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<div className="lz-letter" role="dialog" aria-modal="true" aria-labelledby="lz-letter-title">
				<header className="lz-letter-head">
					<div>
						<p className="lz-letter-kicker">
							<Icon name="mail" size={18} /> {t.lzMailbox} · {letter.from}
						</p>
						<h2 id="lz-letter-title">{letter.title}</h2>
					</div>
					<button type="button" className="lz-letter-close" onClick={onClose} ref={closeRef} aria-label={t.close} title={t.close}>
						<Icon name="x" size={22} />
					</button>
				</header>

				<div className="lz-letter-grid">
					<article className="lz-letter-original" lang="de" aria-label={t.lzOriginal}>
						<Band />
						<div className="lz-letter-paper">
							<p className="lz-letter-from">{letter.from}</p>
							<p className="lz-letter-ref">
								{letter.reference} · {longDate(letter.issued, "de")}
							</p>
							<h3>{letter.kind}</h3>
							{letter.original.slice(1).map((line) => (
								<p key={line}>{line}</p>
							))}
							{paid && (
								<div className="lz-letter-stamp">
									<Stamp spec={{ shape: "rect", top: "Stadt Wien", main: t.lzPaid, date: stampDate(lang), rotate: -6 }} />
								</div>
							)}
						</div>
						<p className="lz-letter-label">{t.lzOriginal}</p>
					</article>

					<section className="lz-letter-plain" aria-label={t.lzPlainWords}>
						<p className="lz-label">{t.lzPlainWords}</p>
						<p className="lz-letter-what">{letter.plain.what}</p>
						<p className="lz-letter-due">
							<b>{amount}</b>
							<span>
								<span className={paid ? "" : "lz-marker"}>{letter.plain.deadline}</span>
							</span>
						</p>
						<dl className="lz-letter-dl">
							<div>
								<dt>{t.lzIfNothing}</dt>
								<dd>{letter.plain.ifNothing}</dd>
							</div>
							<div>
								<dt>{t.lzIfWrong}</dt>
								<dd>{letter.plain.disagree}</dd>
							</div>
						</dl>
						<p className="lz-letter-move">{letter.plain.move}</p>
						<div className="lz-actions">
							{paid ? (
								<p className="lz-letter-paid">
									<Icon name="check" size={20} /> {tpl(t.lzPaidNote, { amount })}
								</p>
							) : (
								<button type="button" className="lz-btn is-primary" onClick={onPay}>
									{tpl(t.lzPay, { amount })}
								</button>
							)}
							<button type="button" className="lz-btn" onClick={onHuman}>
								<Icon name="headset" size={20} /> {t.human}
							</button>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
