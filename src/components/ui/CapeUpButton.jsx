import { useState } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { getGoLabel } from '../../lib/goLabel';
import { getNavigationUrl } from '../../lib/maps';

export default function CapeUpButton({ job, onGo, name }) {
  const { T } = useAppTheme();
  const [flying, setFlying] = useState(false);
  const [label] = useState(() => getGoLabel(job.service || job.service_name, name));

  const driveTimeDisplay = job.driveTime && job.driveTime !== '—' 
    ? job.driveTime 
    : (job.ai_context?.drive_to?.duration || '—');

  const tap = (e) => {
    e.stopPropagation();
    if (flying) return;
    setFlying(true);
    setTimeout(() => { 
      setFlying(false); 
      onGo?.(); 
      const url = getNavigationUrl(job.address);
      if (url) window.open(url, '_blank');
    }, 900);
  };

  return (
    <button
      onClick={tap}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 11,
        background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(233,30,106,0.4)',
        borderRadius: 12, padding: '9px 13px', cursor: 'pointer', overflow: 'visible',
      }}
    >
      <div style={{ position: 'relative', width: 40, height: 36, flexShrink: 0 }}>
        <img
          src="/branding/supermom-go.png"
          alt=""
          className={`sm-hero-icon${flying ? ' flying' : ''}`}
          onError={(e) => {
            // PNG missing — swap to inline SVG cape icon so button still looks intentional.
            e.currentTarget.style.display = 'none';
            const sib = e.currentTarget.nextElementSibling;
            if (sib) sib.style.display = 'flex';
          }}
          style={{
            width: 40, height: 36, borderRadius: 9, objectFit: 'cover',
            position: 'absolute', top: 0, left: 0,
          }}
        />
        <div
          className={`sm-hero-icon${flying ? ' flying' : ''}`}
          style={{
            display: 'none',
            position: 'absolute', top: 0, left: 0,
            width: 40, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg,#FF5A9D,#E91E6A)',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(233,30,106,0.4)',
          }}
          aria-hidden="true"
        >
          {/* Cape silhouette */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 3l3 3-1.5 5L17 18l-6-2-6 2 4.5-7L8 6l3-3z" fill="white" opacity="0.95"/>
            <circle cx="11" cy="6.5" r="1.5" fill="#FFD6E8"/>
          </svg>
        </div>
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{
          fontFamily: T.serif, fontSize: 13.5, fontWeight: 500,
          color: '#FF5A9D', letterSpacing: '-0.2px',
        }}>
          {flying ? 'En Route ✓' : label}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 1 }}>
          {job.address} · {driveTimeDisplay} · auto-timer on
        </div>
      </div>
      {!flying && (
        <svg width="7" height="13" viewBox="0 0 7 13" fill="none">
          <path d="M1 1l5 5.5-5 5.5" stroke="#FF5A9D" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}
