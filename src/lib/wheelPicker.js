// Pure logic for the scroll-snap wheel picker (WheelColumn/WheelTimePicker/WheelDatePicker).
// Kept dependency-free and DOM-free so it can be unit tested directly.

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Nearest item index for a given scrollTop, clamped to the list bounds. */
export function nearestIndex(scrollTop, itemHeight, length) {
  if (length <= 0) return 0;
  const idx = Math.round(scrollTop / itemHeight);
  return Math.max(0, Math.min(length - 1, idx));
}

/** scrollTop that centers the given index. */
export function scrollTopForIndex(index, itemHeight) {
  return index * itemHeight;
}

/** "HH:MM" (24h) -> { hour24, minute } or null if unparseable. */
export function parseHHMM(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour24 = Number(m[1]);
  const minute = Number(m[2]);
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;
  return { hour24, minute };
}

/** 24h hour -> { hour12 (1-12), ampm }. */
export function to12Hour(hour24) {
  const ampm = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 || 12;
  return { hour12, ampm };
}

/** { hour12 (1-12), ampm } -> 24h hour. */
export function from12Hour(hour12, ampm) {
  const h = hour12 % 12; // 12 -> 0
  return ampm === 'PM' ? h + 12 : h;
}

/** hour24, minute -> "HH:MM" zero-padded. */
export function buildHHMM(hour24, minute) {
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
export const MINUTES_5 = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55
export const AMPM = ['AM', 'PM'];

/** "YYYY-MM-DD" -> { year, month (1-12), day } or null if unparseable. */
export function parseISODate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** year, month (1-12) -> number of days in that month. */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** year, month (1-12), day -> "YYYY-MM-DD". */
export function buildISODate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Booking-relevant year range: refYear-1 .. refYear+2. */
export function yearRange(refYear) {
  return [refYear - 1, refYear, refYear + 1, refYear + 2];
}
