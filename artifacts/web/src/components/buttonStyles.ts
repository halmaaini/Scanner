const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Class names for everything that looks like a button, whether it is a
 * <button> or a link. Tailwind reads these strings as written, so every class
 * is spelled out in full.
 *
 * Colour lives in the variant and size in the size, so a button never has two
 * utilities that set the same property (Tailwind would pick one by stylesheet
 * order, not by the order written).
 */
export const buttonStyles = {
  primary: `${base} bg-ink text-white hover:bg-[#1f2f52]`,
  outline: `${base} border-2 border-ink text-ink hover:bg-ink/5`,
  /** White button on a coloured result screen; the caller adds the text colour. */
  onTone: `${base} h-[60px] w-full rounded-[14px] bg-white text-lg`,
  link: "inline-flex min-h-11 items-center text-[15px] font-semibold text-ink underline-offset-4 hover:underline",
  linkOnDark:
    "inline-flex min-h-12 items-center justify-center text-base font-semibold text-white underline-offset-4 hover:underline",
} as const;

export const buttonSizes = {
  /** The usual full-size button. */
  default: "h-14 rounded-[14px] px-6 text-[17px]",
  /** A fixed-width button that sits beside an input. */
  compact: "h-14 w-[116px] shrink-0 rounded-xl px-0 text-base",
} as const;

export type ButtonVariant = "primary" | "outline";
export type ButtonSize = keyof typeof buttonSizes;
