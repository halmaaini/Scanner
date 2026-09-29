/**
 * The value of a design token from index.css (e.g. "ink"), for the few places
 * that need a colour value rather than a class, such as the QR code's SVG
 * (SVG colour attributes cannot use CSS variables).
 */
export function themeColor(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${token}`)
    .trim();
}
