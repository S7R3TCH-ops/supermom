import { useState } from 'react';
import WheelColumn, { ITEM_HEIGHT, VISIBLE_COUNT } from './WheelColumn';
import { HOURS_12, MINUTES_5, AMPM, parseHHMM, to12Hour, from12Hour, buildHHMM } from '../../lib/wheelPicker';

export default function WheelTimePicker({ value, onConfirm, onCancel, T, mode }) {
  const parsed = parseHHMM(value);
  const initial = parsed ? to12Hour(parsed.hour24) : { hour12: 9, ampm: 'AM' };
  const initialMinute = parsed ? Math.round(parsed.minute / 5) * 5 % 60 : 0;

  const [hourIdx, setHourIdx] = useState(Math.max(0, HOURS_12.indexOf(initial.hour12)));
  const [minuteIdx, setMinuteIdx] = useState(Math.max(0, MINUTES_5.indexOf(initialMinute)));
  const [ampmIdx, setAmpmIdx] = useState(AMPM.indexOf(initial.ampm));

  function handleDone() {
    const hour24 = from12Hour(HOURS_12[hourIdx], AMPM[ampmIdx]);
    onConfirm(buildHHMM(hour24, MINUTES_5[minuteIdx]));
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
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Set Time</div>
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
          <div style={{ display: 'flex', gap: 4, width: '100%', maxWidth: 260, height: wheelBoxHeight }}>
            <div style={{ flex: 1 }}>
              <WheelColumn labels={HOURS_12.map(String)} selectedIndex={hourIdx} onChange={setHourIdx} T={T} mode={mode} />
            </div>
            <div style={{ flex: 1 }}>
              <WheelColumn labels={MINUTES_5.map(m => String(m).padStart(2, '0'))} selectedIndex={minuteIdx} onChange={setMinuteIdx} T={T} mode={mode} />
            </div>
            <div style={{ flex: 1 }}>
              <WheelColumn labels={AMPM} selectedIndex={ampmIdx} onChange={setAmpmIdx} T={T} mode={mode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
