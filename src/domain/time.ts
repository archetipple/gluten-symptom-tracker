import type { DateStr, LocalTime } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function dateStr(d: Date = new Date()): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTime(d: Date = new Date()): LocalTime {
  return `${dateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Milliseconds for a local time string (read in this device's time zone). */
export const ms = (t: LocalTime | DateStr) => new Date(t.length === 10 ? `${t}T00:00` : t).getTime();

export const dayOf = (t: LocalTime): DateStr => t.slice(0, 10);

export function addDays(d: DateStr, n: number): DateStr {
  const x = new Date(`${d}T12:00`);
  x.setDate(x.getDate() + n);
  return dateStr(x);
}

/** Every date from `from` to `to` inclusive. */
export function daysBetween(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function fmtTime(t: LocalTime): string {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtDay(d: DateStr, today: DateStr = dateStr()): string {
  if (d === today) return 'Today';
  if (d === addDays(today, -1)) return 'Yesterday';
  return new Date(`${d}T12:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "5 h before", "1 day 3 h before". */
/** Hours and minutes from a duration in hours, e.g. 1.5 -> { h: 1, m: 30 }. */
export function splitHours(hours: number): { h: number; m: number } {
  const total = Math.round(hours * 60);
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** A duration in hours as "45 min", "2 h" or "1 h 30 min". */
export function fmtDuration(hours: number): string {
  const { h, m } = splitHours(hours);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function fmtGap(hours: number): string {
  const h = Math.round(hours);
  if (h < 1) return 'under 1 h before';
  if (h < 24) return `${h} h before`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return `${d} day${d > 1 ? 's' : ''}${r ? ` ${r} h` : ''} before`;
}
