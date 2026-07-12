import { useState, useRef, useMemo, useCallback } from 'react';
import { triggerHaptic } from '../../lib/haptics';

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export default function WeekStrip({
  weekStart,
  selectedDate,
  today,
  allJobs = [],
  onWeekChange,
  onDaySelect,
  T,
  mode = 'light',
  variant = 'home',
}) {
  const [liveOffset, setLiveOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const containerRef = useRef(null);
  const touchRef = useRef({ startX: 0, startY: 0, active: false, scrolling: false, decided: false });
  const liveOffsetRef = useRef(0);
  const isSnappingRef = useRef(false);

  const prevWeekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i - 7)), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const nextWeekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i + 7)), [weekStart]);

  const getJobsForDay = useCallback((d) => {
    return allJobs.filter(j => {
      const date = j.start instanceof Date ? j.start : (j.scheduled_at ? new Date(j.scheduled_at) : null);
      return date && !isNaN(date.getTime()) && sameDay(date, d);
    });
  }, [allJobs]);

  const handleTouchStart = useCallback((e) => {
    if (isSnappingRef.current) return;
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      active: true,
      scrolling: false,
      decided: false,
    };
  }, []);

  const handleTouchMove = useCallback((e) => {
    const t = touchRef.current;
    if (!t.active || t.scrolling || isSnappingRef.current) return;

    const dx = e.touches[0].clientX - t.startX;
    const dy = e.touches[0].clientY - t.startY;

    if (!t.decided) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        t.scrolling = true;
        liveOffsetRef.current = 0;
        setLiveOffset(0);
        return;
      }
      if (Math.abs(dx) > 8) {
        t.decided = true;
      } else {
        return;
      }
    }

    liveOffsetRef.current = dx;
    setLiveOffset(dx);
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const t = touchRef.current;
    t.active = false;
    if (t.scrolling || isSnappingRef.current) return;

    const off = liveOffsetRef.current;
    const THRESHOLD = 50;

    if (Math.abs(off) > THRESHOLD) {
      const panelWidth = containerRef.current?.offsetWidth ?? window.innerWidth;
      const delta = off < 0 ? 1 : -1; // drag left = next week (+1), drag right = prev week (-1)
      const snapTarget = off < 0 ? -panelWidth : panelWidth;

      isSnappingRef.current = true;
      setIsSnapping(true);
      setLiveOffset(snapTarget);
      liveOffsetRef.current = snapTarget;
      triggerHaptic('medium');
      e.stopPropagation();

      setTimeout(() => {
        onWeekChange(delta);
        isSnappingRef.current = false;
        setIsSnapping(false);
        setLiveOffset(0);
        liveOffsetRef.current = 0;
      }, 380);
    } else {
      // Under threshold — spring back
      isSnappingRef.current = true;
      setIsSnapping(true);
      setLiveOffset(0);
      liveOffsetRef.current = 0;
      setTimeout(() => {
        isSnappingRef.current = false;
        setIsSnapping(false);
      }, 380);
    }
  }, [onWeekChange]);

  const renderDayCell = useCallback((d) => {
    const isToday = sameDay(d, today);
    const isSelected = !!selectedDate && sameDay(d, selectedDate);
    const dots = Math.min(getJobsForDay(d).length, 3);

    if (variant === 'calendar') {
      return (
        <div
          key={d.toISOString()}
          role="button"
          aria-label={`${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${dots > 0 ? `, ${dots} job${dots > 1 ? 's' : ''}` : ''}`}
          onClick={() => onDaySelect(isSelected ? null : d)}
          style={{
            textAlign: 'center',
            padding: '4px 2px 5px',
            minHeight: 44,
            borderRadius: 8,
            background: isSelected
              ? '#FC4693'
              : isToday
              ? 'rgba(233,30,106,0.2)'
              : mode === 'dark'
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(255,255,255,0.3)',
            border: isSelected
              ? 'none'
              : `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}`,
            cursor: 'pointer',
          }}
        >
          <div style={{
            fontFamily: T.font,
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
            color: isSelected ? 'rgba(255,255,255,0.8)' : isToday ? T.pink : T.inkMuted,
          }}>
            {d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
          </div>
          <div style={{
            fontFamily: T.serif,
            fontSize: 13,
            fontWeight: 500,
            color: isSelected ? 'white' : mode === 'dark' ? 'white' : T.ink,
            lineHeight: 1.2,
            marginTop: 2,
          }}>
            {d.getDate()}
          </div>
          <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 2, minHeight: 3 }}>
            {Array.from({ length: dots }).map((_, k) => (
              <span key={k} style={{ width: 3, height: 3, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.7)' : T.pink, display: 'block' }} />
            ))}
          </div>
        </div>
      );
    }

    // variant === 'home'
    return (
      <div
        key={d.toISOString()}
        onClick={() => onDaySelect(isSelected ? null : d)}
        style={{
          height: 56,
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: isSelected ? T.pink : 'white',
          border: isSelected
            ? `2px solid ${T.pink}`
            : isToday
            ? `2px solid ${T.pink}40`
            : '2px solid transparent',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: isSelected ? 'white' : T.inkSub, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          {d.toLocaleDateString('en-US', { weekday: 'short' })}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: isSelected ? 'white' : T.ink, marginTop: 1 }}>
          {d.getDate()}
        </div>
        {dots > 0 && (
          <div style={{ position: 'absolute', bottom: 5, display: 'flex', gap: 2 }}>
            {Array.from({ length: dots }).map((_, i) => (
              <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? 'white' : T.pink }} />
            ))}
          </div>
        )}
        {isToday && !isSelected && (
          <div style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: T.pink }} />
        )}
      </div>
    );
  }, [today, selectedDate, getJobsForDay, variant, mode, T, onDaySelect]);

  const panelGridStyle = {
    width: '33.333%',
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: variant === 'home' ? 6 : 3,
    padding: variant === 'home' ? '10px' : '0',
    boxSizing: 'border-box',
    flexShrink: 0,
  };

  const containerStyle = variant === 'home'
    ? {
        overflow: 'hidden',
        borderRadius: 18,
        marginBottom: 24,
        background: T.card,
        border: `1.5px solid ${T.cardBorder}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }
    : {
        overflow: 'hidden',
        marginBottom: 9,
      };

  return (
    <div ref={containerRef} style={containerStyle}>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'flex',
          width: '300%',
          transform: `translateX(calc(-33.333% + ${liveOffset}px))`,
          transition: isSnapping ? 'transform 0.38s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
          willChange: 'transform',
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
      >
        {[prevWeekDays, weekDays, nextWeekDays].map((days, pi) => (
          <div key={pi} style={panelGridStyle}>
            {days.map(d => renderDayCell(d))}
          </div>
        ))}
      </div>
    </div>
  );
}
