import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useAppTheme } from '../context/AppThemeContext';
import { useNewJobSheet } from '../context/NewJobSheetContext';
import AmtCell from '../components/ui/AmtCell';
import SectionLabel from '../components/ui/SectionLabel';
import { useClient } from '../data/useData';

function formatPhone(p) {
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  if (digits.length !== 10) return p;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { T, privacyOn } = useAppTheme();
  const { openFor } = useNewJobSheet();
  const { client, loading, error } = useClient(id);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>
        Loading client…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 18, background: T.bg, color: T.ink }}>
        <div style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, padding: 12, fontFamily: T.font, fontSize: 13 }}>
          {error.message}
        </div>
      </div>
    );
  }
  if (!client) return <Navigate to="/clients" replace />;

  const recurrenceLabel = client.recurrence
    ? client.recurrence.charAt(0).toUpperCase() + client.recurrence.slice(1)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      {/* Dark plum hero */}
      <div style={{
        background: T.hero, borderBottom: '3px solid #E91E6A',
        padding: '12px 14px 16px', position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 180, height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(233,30,106,0.22) 0%,transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Top row: back + label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, position: 'relative' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 9, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
            }}
            aria-label="Back"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{
            fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px',
            textTransform: 'uppercase', color: '#FF78B0',
          }}>✦ Client Profile</div>
          <div style={{ width: 30 }} />
        </div>

        {/* Avatar + name + tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, position: 'relative' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: 'linear-gradient(135deg,#FF5A9D,#E91E6A)',
            border: '2px solid rgba(255,255,255,0.15)',
            boxShadow: '0 6px 16px rgba(233,30,106,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.serif, fontSize: 24, fontWeight: 500, color: 'white',
          }}>{client.init}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: T.serif, fontSize: 22, fontWeight: 500, letterSpacing: '-0.4px',
              color: 'white', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{client.name}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {client.vip && (
                <span style={{
                  background: '#FCD34D', borderRadius: 5, padding: '2px 7px',
                  fontFamily: T.font, fontSize: 9, fontWeight: 700, color: '#78350F',
                  letterSpacing: '0.4px', textTransform: 'uppercase',
                }}>VIP ★</span>
              )}
              {recurrenceLabel && (
                <span style={{
                  background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 5, padding: '2px 7px',
                  fontFamily: T.font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
                  letterSpacing: '0.4px', textTransform: 'uppercase',
                }}>↻ {recurrenceLabel}</span>
              )}
              {client.tags.includes('Lead') && (
                <span style={{
                  background: 'rgba(139,92,246,0.22)', border: '1px solid rgba(139,92,246,0.4)',
                  borderRadius: 5, padding: '2px 7px',
                  fontFamily: T.font, fontSize: 9, fontWeight: 700, color: '#D8B4FE',
                  letterSpacing: '0.4px', textTransform: 'uppercase',
                }}>Lead</span>
              )}
              {client.tags.includes('⚠ Overdue') && (
                <span style={{
                  background: '#FEF3C7', borderRadius: 5, padding: '2px 7px',
                  fontFamily: T.font, fontSize: 9, fontWeight: 700, color: '#78350F',
                  letterSpacing: '0.4px', textTransform: 'uppercase',
                }}>⚠ Overdue</span>
              )}
            </div>
          </div>
        </div>

        {/* 3-stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12, position: 'relative' }}>
          {[
            { n: String(client.stats.jobsTotal), l: 'Jobs' },
            { n: privacyOn ? '•••' : `$${client.stats.revenueYtd.toLocaleString()}`, l: 'Revenue YTD' },
            { n: client.stats.lastVisit, l: 'Last visit' },
          ].map(s => (
            <div key={s.l} style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 11, padding: '9px 6px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: 'white', letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums' }}>{s.n}</div>
              <div style={{ fontFamily: T.font, fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <button
            onClick={() => openFor(client.id)}
            style={{
              flex: 2, background: '#E91E6A', border: 'none', borderRadius: 12,
              padding: '11px 0', fontFamily: T.font, fontSize: 13, fontWeight: 700, color: 'white',
              cursor: 'pointer', letterSpacing: '0.2px',
            }}>Book Job</button>
          <button style={{
            flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12, padding: '11px 0',
            fontFamily: T.font, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer',
          }}>Message</button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 13px 12px' }}>

        {/* AI "What I know" card — white/card bg, intentional contrast vs hero */}
        <div style={{
          background: T.card, border: `1.5px solid ${T.cardBorder}`,
          borderRadius: 16, padding: '12px 14px', marginBottom: 14,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -28, right: -18, width: 90, height: 90, borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(233,30,106,0.12) 0%,transparent 70%)', pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{
              fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px',
              textTransform: 'uppercase', color: '#FF78B0',
            }}>✦ What I know</div>
            <button style={{
              background: 'none', border: 'none', padding: 0,
              fontFamily: T.font, fontSize: 10, fontWeight: 600, color: T.inkMuted, cursor: 'pointer',
            }}>Edit</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { k: 'Prefs',    v: client.aiContext.prefs },
              { k: 'Access',   v: client.aiContext.access },
              { k: 'Comms',    v: client.aiContext.comms },
              { k: 'Personal', v: client.aiContext.personal },
            ].map(row => (
              <div key={row.k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{
                  fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
                  textTransform: 'uppercase', color: T.inkMuted,
                  flexShrink: 0, width: 58, marginTop: 2,
                }}>{row.k}</span>
                <span style={{ fontFamily: T.font, fontSize: 11.5, color: T.inkSub, lineHeight: 1.45, flex: 1 }}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <SectionLabel>Contact</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          <ContactRow
            T={T}
            href={`tel:${client.phone}`}
            icon={<PhoneIcon />}
            label={formatPhone(client.phone)}
            sub="Tap to call"
          />
          <ContactRow
            T={T}
            href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`}
            icon={<PinIcon />}
            label={client.address}
            sub="Tap for directions"
          />
          <ContactRow
            T={T}
            href={`mailto:${client.email}`}
            icon={<MailIcon />}
            label={client.email}
            sub="Tap to email"
          />
        </div>

        {/* Upcoming */}
        <SectionLabel>Upcoming</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {client.upcoming.length === 0 ? (
            <div style={{
              background: T.card, border: `1.5px dashed ${T.cardBorder}`,
              borderRadius: 13, padding: '14px 14px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: T.font, fontSize: 11.5, color: T.inkMuted, marginBottom: 6 }}>
                No upcoming jobs booked
              </div>
              <button
                onClick={() => openFor(client.id)}
                style={{
                  background: T.pink, color: 'white', border: 'none', borderRadius: 8,
                  padding: '6px 14px', fontFamily: T.font, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>Book new job</button>
            </div>
          ) : (
            client.upcoming.map((j, i) => (
              <div key={i} style={{
                background: T.card, border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 13, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 42, flexShrink: 0, textAlign: 'center',
                  fontFamily: T.serif, color: T.pink,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.2px' }}>{j.date.split(' ')[1]}</div>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 1 }}>{j.date.split(' ')[0]}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px' }}>{j.service}</div>
                  <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkMuted, marginTop: 1 }}>{j.time}</div>
                </div>
                <AmtCell amount={j.amt} size={14} />
              </div>
            ))
          )}
        </div>

        {/* Recent history */}
        <SectionLabel>Recent history</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {client.history.length === 0 ? (
            <div style={{
              background: T.card, border: `1.5px solid ${T.cardBorder}`,
              borderRadius: 13, padding: '14px', textAlign: 'center',
              fontFamily: T.font, fontSize: 11.5, color: T.inkMuted,
            }}>
              No history yet.
            </div>
          ) : (
            client.history.slice(0, 5).map((h, i) => (
              <div key={i} style={{
                background: T.card, border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 13, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 42, flexShrink: 0, textAlign: 'center',
                  fontFamily: T.serif, color: T.inkSub,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.2px' }}>{h.date.split(' ')[1]}</div>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 1 }}>{h.date.split(' ')[0]}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px' }}>{h.service}</div>
                  <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 1 }}>{h.duration}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <AmtCell amount={h.amt} size={13} />
                  <span style={{
                    background: h.status === 'paid' ? '#DCFCE7' : '#FFE0EC',
                    color:      h.status === 'paid' ? '#14532D' : '#9B0D3A',
                    borderRadius: 5, padding: '1px 6px',
                    fontFamily: T.font, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                  }}>{h.status === 'paid' ? 'Paid ✓' : 'Unpaid'}</span>
                </div>
              </div>
            ))
          )}
          {client.history.length > 5 && (
            <button style={{
              background: 'none', border: 'none', padding: '8px 0',
              fontFamily: T.font, fontSize: 11, fontWeight: 600, color: T.pink, cursor: 'pointer',
              textAlign: 'center',
            }}>View all {client.history.length} jobs →</button>
          )}
        </div>

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

function ContactRow({ T, href, icon, label, sub }) {
  return (
    <a
      href={href}
      style={{
        background: T.card, border: `1.5px solid ${T.cardBorder}`,
        borderRadius: 13, padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 11,
        textDecoration: 'none', color: 'inherit',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: T.pinkTint, border: `1px solid ${T.cardBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.pink,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: T.font, fontSize: 12.5, fontWeight: 500, color: T.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</div>
        <div style={{ fontFamily: T.font, fontSize: 9.5, color: T.inkMuted, marginTop: 1, letterSpacing: '0.3px' }}>{sub}</div>
      </div>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
        <path d="M3 1l4 4-4 4" stroke={T.inkMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5c0 4.5 4 8.5 8.5 8.5.6 0 1-.4 1-1v-1.5c0-.4-.3-.8-.7-.9l-1.7-.4c-.4-.1-.8.1-1 .4l-.5.8c-1.5-.7-2.7-1.9-3.4-3.4l.8-.5c.3-.2.5-.6.4-1l-.4-1.7c-.1-.4-.5-.7-.9-.7H2.5c-.3 0-.5.2-.5.5v.4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5c-2.2 0-4 1.8-4 4 0 3 4 7 4 7s4-4 4-7c0-2.2-1.8-4-4-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="7" cy="5.5" r="1.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="3" width="11" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.8 3.6l5.2 3.8 5.2-3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
