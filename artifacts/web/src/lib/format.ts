import { LOCALE } from "@/config";

const time = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
});
const dayAndTime = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "10:42" */
export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

/** "10:42" for today, "Thu 11 Jun, 09:14" for any other day. */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  return sameDay(date, now) ? time.format(date) : dayAndTime.format(date);
}

const two = (n: number) => String(n).padStart(2, "0");

/**
 * "2026-06-11 12:14:00" in this device's time zone: the shape spreadsheets
 * read as a date and time (an ISO string with a "Z" they leave as text).
 */
export function formatSpreadsheetTime(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ` +
    `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
  );
}
