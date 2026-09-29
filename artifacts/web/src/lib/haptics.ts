/** Short buzz where the browser supports it (Android); silently nothing elsewhere. */
export function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is a nicety; never let it break a scan.
  }
}

export const BUZZ_OK = 60;
export const BUZZ_ATTENTION = [90, 60, 90];
