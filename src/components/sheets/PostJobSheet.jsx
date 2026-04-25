import { useEffect, useState } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import SectionLabel from '../ui/SectionLabel';
import { fetchJobById, recordPayment } from '../../data/jobsRepo';
import { notifyDataChanged } from '../../data/useData';

function fmtDuration(hours) {
  if (!hours) return null;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function PostJobSheet({ jobId, onClose }) {
  const { T, mode } = useAppTheme();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState(null);
  const [method, setMethod] = useState('Cash');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [mutErr, setMutErr] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFetchErr(null);
    fetchJobById(jobId)
      .then(j => {
        setJob(j);
        setAmount(String(j?.total_amount ?? j?.flat_rate ?? 0));
      })
      .catch(e => setFetchErr(e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  async function handleLogPayment() {
    setBusy(true);
    setMutErr(null);
    try {
      const amt = parseFloat(amount) || 0;
      await recordPayment(jobId, amt, method);
      notifyDataChanged();
      setDone(true);
      setTimeout(onClose, 1400);
    } catch (e) {
      setMutErr(e.message || String(e));
      setBusy(false);
    }
  }

  const isPaid = job?.payment_status === 'Paid';
  const totalAmt = parseFloat(job?.total_amount ?? job?.flat_rate ?? 0);
  const actualDuration = job?.actual_duration || job?.estimated_hours;
  const parsedAmount = parseFloat(amount) || 0;

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(4,1,12,0.65)',
      animation: 'pjFade 180ms ease-out',
    }}>
      <style>{`
        @keyframes pjFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pjSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div onClick={onClose} style={{ flex: 1, minHeight: 40 }} />

      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg, color: T.ink,
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        animation: 'pjSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
        border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
      }}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <div style={{ width: 40, height: 4, background: '#FFD6E8', borderRadius: 4, opacity: mode === 'dark' ? 0.35 : 1 }} />
        </div>

        {/* Dark hero */}
        <div style={{
          background: 'linear-gradient(145deg,#1A0A12 0%,#2C0B1A 100%)',
          borderBottom: '3px solid #E91E6A',
          padding: '12px 18px 16px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.22) 0%,transparent 65%)', pointerEvents: 'none' }} />

          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 6 }}>
            ✦ Job Complete
          </div>

          {loading && <div style={{ fontFamily: T.font, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Loading…</div>}
          {fetchErr && <div style={{ fontFamily: T.font, fontSize: 12, color: '#F87171' }}>{fetchErr}</div>}

          {!loading && !fetchErr && job && (
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
                  {job.service_name}
                </div>
                <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: 'white', letterSpacing: '-0.4px' }}>
                  {job.client_name}
                </div>
                {actualDuration && (
                  <div style={{ fontFamily: T.font, fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
                    {fmtDuration(actualDuration)} on site
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                {!isPaid ? (
                  <span style={{
                    display: 'inline-block', marginBottom: 6,
                    background: '#FFE0EC', color: '#9B0D3A',
                    borderRadius: 5, padding: '2px 7px',
                    fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                  }}>UNPAID</span>
                ) : (
                  <span style={{
                    display: 'inline-block', marginBottom: 6,
                    background: 'rgba(34,197,94,0.2)', color: '#4ADE80',
                    borderRadius: 5, padding: '2px 7px',
                    fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                  }}>PAID ✓</span>
                )}
                <div style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 500, color: 'white', letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' }}>
                  ${totalAmt.toFixed(0)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 14px' }}>

          {!loading && !fetchErr && job && !isPaid && (
            <>
              <SectionLabel>Payment method</SectionLabel>
              <div style={{
                display: 'flex',
                background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#FFF0F7',
                borderRadius: 10, padding: 3, marginBottom: 14,
              }}>
                {['Cash', 'e-Transfer'].map(m => {
                  const on = method === m;
                  return (
                    <button key={m} onClick={() => setMethod(m)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                      background: on ? '#E91E6A' : 'transparent',
                      fontFamily: T.font, fontSize: 12, fontWeight: 600,
                      color: on ? 'white' : T.inkSub, cursor: 'pointer',
                    }}>{m}</button>
                  );
                })}
              </div>

              <SectionLabel>Amount</SectionLabel>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: T.card, border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 12, padding: '10px 14px', marginBottom: 14,
              }}>
                <span style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.inkSub }}>$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  step="1"
                  min="0"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: T.ink,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px',
                  }}
                />
              </div>

              {mutErr && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #FECACA', fontFamily: T.font, fontSize: 11.5, color: '#991B1B', marginBottom: 12 }}>
                  {mutErr}
                </div>
              )}
            </>
          )}

          {!loading && !fetchErr && job && isPaid && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>
              Payment already recorded ✓
            </div>
          )}

          {done && (
            <div style={{ padding: '12px 0', textAlign: 'center', fontFamily: T.serif, fontSize: 15, color: '#22C55E' }}>
              Payment logged ✓
            </div>
          )}

          {/* AI thank-you teaser — wires to item 13 when built */}
          {!loading && !fetchErr && job && (
            <div style={{
              background: 'linear-gradient(145deg,#1A0A12 0%,#2C0B1A 100%)',
              borderRadius: 16, padding: '13px 14px', marginTop: 8,
              position: 'relative', overflow: 'hidden',
              display: 'flex', alignItems: 'center', gap: 12,
              opacity: 0.55,
            }}>
              <div style={{ position: 'absolute', top: -30, right: -20, width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.22) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div style={{
                width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg,#FF5A9D,#E91E6A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 14, color: 'white' }}>✦</span>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 2 }}>
                  Thank-you Draft
                </div>
                <div style={{ fontFamily: T.font, fontSize: 11.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                  AI-drafted receipt message — coming soon.
                </div>
              </div>
              <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px', flexShrink: 0 }}>SOON</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !fetchErr && job && (
          <div style={{
            padding: '10px 18px 18px',
            borderTop: `1px solid ${T.cardBorder}`,
            display: 'flex', gap: 10, background: T.bg,
          }}>
            <button onClick={onClose} style={{
              flex: 1, background: 'transparent',
              border: `1.5px solid ${T.cardBorder}`, color: T.inkSub,
              borderRadius: 12, padding: '12px 0',
              fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Close</button>

            {!isPaid && (
              <button
                onClick={handleLogPayment}
                disabled={busy || done || parsedAmount <= 0}
                style={{
                  flex: 2,
                  background: busy || done || parsedAmount <= 0 ? (mode === 'dark' ? 'rgba(233,30,106,0.28)' : '#F9C5DB') : '#E91E6A',
                  color: 'white', border: 'none', borderRadius: 12, padding: '12px 0',
                  fontFamily: T.font, fontSize: 13, fontWeight: 700,
                  cursor: busy || done || parsedAmount <= 0 ? 'default' : 'pointer',
                  boxShadow: busy || done || parsedAmount <= 0 ? 'none' : '0 4px 12px rgba(233,30,106,0.3)',
                }}
              >
                {busy ? 'Recording…' : done ? 'Logged ✓' : `Log Payment · $${parsedAmount.toFixed(0)}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
