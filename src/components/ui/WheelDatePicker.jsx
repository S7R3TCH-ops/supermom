import { useState, useMemo } from 'react';
import WheelColumn, { ITEM_HEIGHT, VISIBLE_COUNT } from './WheelColumn';
import { MONTH_NAMES, parseISODate, daysInMonth, buildISODate, yearRange } from '../../lib/wheelPicker';

function todayParts() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export default function WheelDatePicker({ value, onConfirm, onCancel, T, mode }) {
  const parsed = parseISODate(value) || todayParts();
  const years = useMemo(() => yearRange(todayParts().year), []);

  const [monthIdx, setMonthIdx] = useState(parsed.month - 1);
  const [dayIdx, setDayIdx] = useState(parsed.day - 1);
  const [yearIdx, setYearIdx] = useState(Math.max(0, years.indexOf(parsed.year)));

  const dayCount = daysInMonth(years[yearIdx], monthIdx + 1);
  const dayLabels = Array.from({ length: dayCount }, (_, i) => String(i + 1));
  const clampedDayIdx = Math.min(dayIdx, dayCount - 1);

  const weekday = new Date(years[yearIdx], monthIdx, clampedDayIdx + 1).toLocaleDateString('en-US', { weekday: 'long' });

  function handleDone() {
    onConfirm(buildISODate(years[yearIdx], monthIdx + 1, clampedDayIdx + 1));
  }

  const highlightHeight = ITEM_HEIGHT;
  const wheelBoxHeight = ITEM_HEIGHT * VISIBLE_COUNT;

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 500, margin: '0 auto',
          background: T.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${T.cardBorder}` }}>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: T.inkMuted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Set Date</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.inkMuted }}>{weekday}</div>
          </div>
          <button onClick={handleDone} style={{ background: 'none', border: 'none', color: T.pink, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Done</button>
        </div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '8px 20px 4px' }}>
          <div
            style={{
              position: 'absolute', top: '50%', left: 20, right: 20, transform: 'translateY(-50%)',
              height: highlightHeight, borderRadius: 10,
              background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 4, width: '100%', maxWidth: 300, height: wheelBoxHeight }}>
            <div style={{ flex: 1.3 }}>
              <WheelColumn labels={MONTH_NAMES} selectedIndex={monthIdx} onChange={setMonthIdx} T={T} mode={mode} />
            </div>
            <div style={{ flex: 1 }}>
              <WheelColumn labels={dayLabels} selectedIndex={clampedDayIdx} onChange={setDayIdx} T={T} mode={mode} />
            </div>
            <div style={{ flex: 1.2 }}>
              <WheelColumn labels={years.map(String)} selectedIndex={yearIdx} onChange={setYearIdx} T={T} mode={mode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
