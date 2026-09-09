'use client';

/**
 * A small "i" that explains a figure on hover, and on keyboard focus.
 *
 * Every number on this page is derived from something — transfers stripped out,
 * a projection scaled by days, a total that excludes what it could not classify.
 * A reader who cannot see that rule has to either trust the number blindly or
 * distrust it entirely, and neither is useful. The text is the element's
 * accessible name too, so it is not only available to a mouse.
 */
export default function InfoMark({ text, tone }: { text: string; tone?: 'warn' }) {
  return (
    <span
      className={tone === 'warn' ? 'warn-mark' : 'info-mark'}
      tabIndex={0}
      role="note"
      aria-label={text}
      data-tip={text}
    >
      {tone === 'warn' ? '!' : 'i'}
    </span>
  );
}
