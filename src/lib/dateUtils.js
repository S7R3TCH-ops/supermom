export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  const mon = new Date(d.setDate(diff));
  mon.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

export function getWeekLabel(weekDays) {
  const first = weekDays[0];
  const last = weekDays[6];
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString('en-US', { month: 'long' })} ${first.getDate()}–${last.getDate()}`;
  }
  return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function fmtTime12(d) {
  // Use Intl to extract hours/minutes in Toronto timezone, so display is correct
  // regardless of the browser's local timezone setting.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d);
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
  const hh = ((h + 11) % 12) + 1;
  const ap = h < 12 ? 'AM' : 'PM';
  return { time: m === 0 ? `${hh}:00` : `${hh}:${m.toString().padStart(2, '0')}`, period: ap };
}

export function fmtTimeRange(start, end) {
  const s = fmtTime12(start);
  const e = fmtTime12(end);
  return s.period === e.period
    ? `${s.time} – ${e.time} ${e.period}`
    : `${s.time} ${s.period} – ${e.time} ${e.period}`;
}

export function dateBrief(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Produces a Toronto-timezone ISO string (e.g. "2026-05-18T09:00:00-04:00").
// Uses Intl.DateTimeFormat to determine the correct UTC offset for the given date,
// so DST transitions are handled automatically without hardcoded rules.
export function composeTorontoISO(dateStr, timeStr) {
  if (!dateStr) return null;

  let t = '00:00';
  if (timeStr && typeof timeStr === 'string') {
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      t = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  try {
    // Parse as a naive local instant in Toronto time, then determine its UTC offset.
    const [hours, minutes] = t.split(':').map(Number);
    // Use a UTC noon anchor to determine DST state for the calendar date (noon is
    // always well within the DST-safe window — never within 1h of a clock change).
    const noonUTC = new Date(Date.UTC(year, month - 1, day, 17, 0, 0)); // 17:00 UTC = noon Toronto EST
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(noonUTC);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value ?? '-05:00';
    // offsetPart is like "GMT-4" or "GMT-5"; convert to ±HH:MM
    const match = offsetPart.match(/GMT([+-]\d+)/);
    const offsetHours = match ? parseInt(match[1], 10) : -5;
    const sign = offsetHours >= 0 ? '+' : '-';
    const absH = Math.abs(offsetHours).toString().padStart(2, '0');
    const offsetStr = `${sign}${absH}:00`;

    return `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00${offsetStr}`;
  } catch (e) {
    console.error('Error composing ISO date:', e);
    return null;
  }
}
