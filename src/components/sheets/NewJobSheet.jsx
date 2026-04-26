import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import SectionLabel from '../ui/SectionLabel';
import NewClientSheet from './NewClientSheet';
import { fetchClients } from '../../data/clientsRepo';
import { fetchActiveJobs, createJob, findConflicts, fetchJobsByClientId, composeTorontoISO } from '../../data/jobsRepo';
import { toDisplayClient } from '../../data/selectors';
import { notifyDataChanged, useBusiness } from '../../data/useData';
import { SERVICES, RECURRENCE } from '../../data/services';
import { calculateEstimatedDuration, fetchSmartDurationEstimate } from '../../data/ai';

function todayISODate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
}

function fmtTimeRange(timeStr, durationMin) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const startMin = h * 60 + m;
  const endMin = startMin + durationMin;
  const fmt = total => {
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    const ampm = hh < 12 ? 'AM' : 'PM';
    const h12 = ((hh + 11) % 12) + 1;
    return `${h12}:${mm.toString().padStart(2, '0')} ${ampm}`;
  };
  return `${fmt(startMin)} – ${fmt(endMin)}`;
}

function fmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function NewJobSheet({ prefillClientId, onClose }) {
  const { T, mode, privacyOn } = useAppTheme();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);
  const [step, setStep] = useState(1);

  // Fetch clients + jobs on mount (for the picker + conflict detection).
  const [clientRows, setClientRows] = useState([]);
  const [jobRows, setJobRows] = useState([]);
  const [clientJobs, setClientJobs] = useState([]);
  const [loadErr, setLoadErr] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchClients(), fetchActiveJobs()])
      .then(([cs, js]) => { if (alive) { setClientRows(cs); setJobRows(js); } })
      .catch(e => { if (alive) setLoadErr(e); });
    return () => { alive = false; };
  }, []);

  const [clientId, setClientId] = useState(prefillClientId || null);

  useEffect(() => {
    if (!clientId) {
      setClientJobs([]);
      return;
    }
    fetchJobsByClientId(clientId).then(setClientJobs).catch(console.error);
  }, [clientId]);

  const clientsDisplay = useMemo(
    () => clientRows.map(r => toDisplayClient(r, [])),
    [clientRows]
  );
  const getDisplayClient = id => clientsDisplay.find(c => c.id === id) || null;

  // For the selected client, we want the "full" display model with history for the AI estimator
  const selectedClient = useMemo(() => {
    if (!clientId) return null;
    const row = clientRows.find(r => r.id === clientId);
    if (!row) return null;
    return toDisplayClient(row, clientJobs);
  }, [clientId, clientRows, clientJobs]);
  const prefillClient = prefillClientId ? getDisplayClient(prefillClientId) : null;

  const seededService = useMemo(() => {
    if (!prefillClient) return null;
    const s = SERVICES.find(x => x.label.toLowerCase() === (prefillClient.service || '').toLowerCase());
    return s ? s.key : null;
  }, [prefillClient]);

  const { business } = useBusiness();
  const [serviceKey, setServiceKey] = useState(seededService);
  const [date, setDate] = useState(todayISODate());
  const [time, setTime] = useState('10:00');
  const service = SERVICES.find(s => s.key === serviceKey) || null;
  const [duration, setDuration] = useState(service?.defaultDuration || 120);
  const [recurrence, setRecurrence] = useState(prefillClient?.recurrence || null);
  const [confirmText, setConfirmText] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bookErr, setBookErr] = useState('');

  const [durationTouched, setDurationTouched] = useState(false);
  const [aiDuration, setAiDuration] = useState(null);
  const [aiEstimateLoading, setAiEstimateLoading] = useState(false);
  const [aiEstimateReason, setAiEstimateReason] = useState('');

  const onPickService = async (key) => {
    setServiceKey(key);
    const svc = SERVICES.find(s => s.key === key);
    if (!svc) return;

    // 1. Local deterministic estimate (fast fallback)
    const localEstimate = calculateEstimatedDuration(selectedClient, key, SERVICES);
    setAiDuration(localEstimate !== svc.defaultDuration ? localEstimate : null);
    if (!durationTouched) setDuration(localEstimate);

    // 2. Fetch AI smart estimate if we have a client selected
    if (selectedClient?.id) {
      setAiEstimateLoading(true);
      setAiEstimateReason('');
      try {
        const smart = await fetchSmartDurationEstimate(selectedClient.id, svc.label, business);
        if (smart && smart.duration_minutes) {
          setAiDuration(smart.duration_minutes);
          setAiEstimateReason(smart.reasoning);
          if (!durationTouched) {
            setDuration(smart.duration_minutes);
          }
        }
      } catch (err) {
        console.warn('Smart duration fetch failed:', err);
      } finally {
        setAiEstimateLoading(false);
      }
    }
  };

  const canNext1 = !!clientId;
  const canNext2 = !!serviceKey && !!date && !!time;

  const scheduledISO = composeTorontoISO(date, time);
  const conflicts = useMemo(() => {
    if (!scheduledISO) return [];
    return findConflicts(jobRows, scheduledISO, duration, 60).filter(j => j.client_id !== clientId);
  }, [scheduledISO, duration, clientId, jobRows]);

  const price = service ? service.rate : 0;
  const priceStr = `$${price}`;

  async function handleBook() {
    setBusy(true);
    setBookErr('');
    try {
      const hours = duration / 60;
      await createJob({
        client_id: clientId,
        service_name: service?.label || null,
        scheduled_date: date,
        scheduled_time: time,
        scheduling_type: 'Hard Date',
        pricing_type: 'Flat',
        estimated_hours: hours,
        flat_rate: price,
        subtotal: price,
        total_amount: price,
        job_status: 'Scheduled',
        payment_status: '',
        job_notes: selectedClient?.note || '',
        ai_context: { recurrence_rule: recurrence },
      });
      notifyDataChanged();
      onClose();
    } catch (e) {
      setBookErr(e.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Book new job" style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(4,1,12,0.62)', animation: 'njFade 180ms ease-out',
    }}>
      <style>{`
        @keyframes njFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes njSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div onClick={onClose} style={{ flex: 1, minHeight: 40 }} />

      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg, color: T.ink,
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        animation: 'njSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
        border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <div style={{ width: 40, height: 4, background: '#FFD6E8', borderRadius: 4, opacity: mode === 'dark' ? 0.35 : 1 }} />
        </div>

        <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0' }}>
              ✦ New Job · Step {step} of 3
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, letterSpacing: '-0.4px', color: T.ink, marginTop: 2 }}>
              {step === 1 && 'Who is it for?'}
              {step === 2 && 'What & when?'}
              {step === 3 && 'Review & book'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 30, height: 30, borderRadius: 9,
            background: mode === 'dark' ? 'rgba(255,255,255,0.07)' : T.pinkTint,
            border: `1px solid ${T.cardBorder}`, color: T.inkSub, cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '4px 18px 10px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: n < step ? '#22C55E' : n === step ? '#E91E6A' : (mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#FFD6E8'),
            }} />
          ))}
        </div>

        <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 14px' }}>
          {loadErr && (
            <div style={{ padding: 10, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.ink, font: `12px/1.4 ${T.font}`, marginBottom: 10 }}>
              Failed to load: {loadErr.message}
            </div>
          )}

          {step === 1 && (
            <Step1Who
              T={T} mode={mode}
              clients={clientsDisplay}
              selectedId={clientId} onSelect={setClientId}
              onAddNew={() => setShowNewClient(true)}
            />
          )}
          {step === 2 && (
            <Step2What
              T={T} mode={mode} client={selectedClient}
              serviceKey={serviceKey} onPickService={onPickService}
              date={date} setDate={setDate} time={time} setTime={setTime}
              duration={duration} setDuration={d => { setDurationTouched(true); setDuration(d); }}
              recurrence={recurrence} setRecurrence={setRecurrence}
              aiDuration={aiDuration}
              aiEstimateLoading={aiEstimateLoading}
              aiEstimateReason={aiEstimateReason}
            />
          )}
          {step === 3 && (
            <Step3Review
              T={T} mode={mode} privacyOn={privacyOn}
              client={selectedClient} service={service}
              date={date} time={time} duration={duration} recurrence={recurrence}
              priceStr={priceStr} conflicts={conflicts}
              clientLookup={getDisplayClient}
              confirmText={confirmText} setConfirmText={setConfirmText}
            />
          )}

          {bookErr && step === 3 && (
            <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: T.redBg, border: `1px solid ${T.redBorder}`, color: T.ink, font: `12px/1.4 ${T.font}` }}>{bookErr}</div>
          )}
        </div>

        <div style={{
          padding: '10px 18px 18px',
          borderTop: `1px solid ${T.cardBorder}`,
          display: 'flex', gap: 10, background: T.bg,
        }}>
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} style={{
              flex: 1, background: 'transparent',
              border: `1.5px solid ${T.cardBorder}`, color: T.inkSub,
              borderRadius: 12, padding: '12px 0',
              fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Back</button>
          ) : (
            <button onClick={onClose} style={{
              flex: 1, background: 'transparent',
              border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted,
              borderRadius: 12, padding: '12px 0',
              fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Cancel</button>
          )}

          {step < 3 && (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !canNext1 : !canNext2}
              style={{
                flex: 2,
                background: (step === 1 ? canNext1 : canNext2) ? '#E91E6A' : (mode === 'dark' ? 'rgba(233,30,106,0.28)' : '#F9C5DB'),
                color: 'white', border: 'none', borderRadius: 12, padding: '12px 0',
                fontFamily: T.font, fontSize: 13, fontWeight: 700,
                cursor: (step === 1 ? canNext1 : canNext2) ? 'pointer' : 'not-allowed',
              }}
            >Next →</button>
          )}

          {step === 3 && (
            <button onClick={handleBook} disabled={busy} style={{
              flex: 2,
              background: 'linear-gradient(135deg,#1A0A12,#2C0B1A)',
              border: '1.5px solid #E91E6A', color: 'white',
              borderRadius: 12, padding: '12px 0',
              fontFamily: T.serif, fontSize: 15, fontWeight: 500,
              cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
              boxShadow: '0 6px 18px rgba(233,30,106,0.35)',
            }}>{busy ? 'Booking…' : '🦸‍♀️ Book it!'}</button>
          )}
        </div>
      </div>

      {showNewClient && (
        <NewClientSheet
          onClose={() => setShowNewClient(false)}
          onCreated={(created) => {
            // Refetch + auto-select the new client
            fetchClients().then(rows => {
              setClientRows(rows);
              setClientId(created.id);
            });
          }}
        />
      )}
    </div>
  );
}

/* ============= STEP 1 ============= */
function Step1Who({ T, mode, clients, selectedId, onSelect, onAddNew }) {
  const selected = selectedId ? clients.find(c => c.id === selectedId) : null;

  return (
    <>
      <SectionLabel>Recent clients</SectionLabel>
      {clients.length === 0 ? (
        <div style={{ padding: '12px 0', color: T.inkMuted, fontFamily: T.font, fontSize: 12 }}>
          No clients yet. Tap "+ New client" below to add one.
        </div>
      ) : (
        <div className="sm-scroll" style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          paddingBottom: 4, marginBottom: 14, marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4,
        }}>
          {clients.map(c => {
            const on = c.id === selectedId;
            return (
              <button key={c.id} onClick={() => onSelect(c.id)} style={{
                flexShrink: 0, width: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: on ? (mode === 'dark' ? 'rgba(233,30,106,0.12)' : '#FFF0F7') : T.card,
                border: `1.5px solid ${on ? '#E91E6A' : T.cardBorder}`,
                borderRadius: 14, padding: '10px 6px', cursor: 'pointer',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: c.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.serif, fontSize: 18, fontWeight: 500, color: 'white',
                  boxShadow: on ? '0 4px 12px rgba(233,30,106,0.35)' : 'none',
                }}>{c.init}</div>
                <div style={{
                  fontFamily: T.font, fontSize: 10, fontWeight: 600, color: T.ink,
                  textAlign: 'center', lineHeight: 1.15, maxWidth: '100%',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{c.name.split(' ')[0]}</div>
                {c.vip && (
                  <span style={{
                    background: '#FCD34D', borderRadius: 4, padding: '1px 5px',
                    fontFamily: T.font, fontSize: 7.5, fontWeight: 700, color: '#78350F', letterSpacing: '0.3px',
                  }}>VIP ★</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div style={{
          background: T.hero,
          border: '1.5px solid rgba(233,30,106,0.32)',
          borderRadius: 14, padding: '11px 12px',
          position: 'relative', overflow: 'hidden', marginBottom: 12,
        }}>
          <div style={{ position: 'absolute', top: -25, right: -15, width: 90, height: 90, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: selected.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.serif, fontSize: 19, fontWeight: 500, color: 'white',
              border: '1.5px solid rgba(255,255,255,0.15)',
            }}>{selected.init}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: 'white', letterSpacing: '-0.3px' }}>{selected.name}</div>
              <div style={{ fontFamily: T.font, fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
                {selected.service !== '—' ? `Usual: ${selected.service} · last ${selected.last}` : 'No previous jobs'}
              </div>
            </div>
            <span style={{
              background: '#E91E6A', color: 'white', borderRadius: 5, padding: '2px 7px',
              fontFamily: T.font, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
            }}>Pre-fill on</span>
          </div>
        </div>
      )}

      <button
        onClick={onAddNew}
        style={{
          width: '100%', background: 'transparent',
          border: `1.5px dashed ${T.cardBorder}`,
          borderRadius: 12, padding: '11px 0',
          fontFamily: T.font, fontSize: 11.5, fontWeight: 600, color: T.pink,
          cursor: 'pointer',
        }}
      >+ New client</button>
    </>
  );
}

/* ============= STEP 2 ============= */
function Step2What({
  T, mode, client, serviceKey, onPickService,
  date, setDate, time, setTime, duration, setDuration,
  recurrence, setRecurrence, aiDuration,
  aiEstimateLoading, aiEstimateReason
}) {
  const usualKey = client && client.service ? (
    SERVICES.find(s => s.label.toLowerCase() === client.service.toLowerCase())?.key
  ) : null;
  const inputBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff';

  return (
    <>
      <SectionLabel>Service</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 14 }}>
        {SERVICES.filter(s => s.key !== 'custom').map(s => {
          const on = s.key === serviceKey;
          const usual = s.key === usualKey;
          return (
            <button key={s.key} onClick={() => onPickService(s.key)} style={{
              background: on ? (mode === 'dark' ? 'rgba(233,30,106,0.14)' : '#FFF0F7') : T.card,
              border: `1.5px solid ${on ? '#E91E6A' : T.cardBorder}`,
              borderRadius: 12, padding: '10px 11px',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
              cursor: 'pointer', position: 'relative', minHeight: 64,
            }}>
              {usual && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  background: '#FCD34D', borderRadius: 4, padding: '1px 5px',
                  fontFamily: T.font, fontSize: 7.5, fontWeight: 700, color: '#78350F',
                  letterSpacing: '0.3px', textTransform: 'uppercase',
                }}>★ Usual</span>
              )}
              <div style={{ fontSize: 15 }}>{s.emoji}</div>
              <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px' }}>{s.label}</div>
              <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, fontVariantNumeric: 'tabular-nums' }}>${s.rate} · {fmtDuration(s.defaultDuration)}</div>
            </button>
          );
        })}
      </div>

      <SectionLabel>When</SectionLabel>
      <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 4 }}>Date</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{
            width: '100%', background: inputBg, color: T.ink,
            border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
            padding: '10px 11px', fontFamily: T.font, fontSize: 13, fontWeight: 500,
            outline: 'none', colorScheme: mode === 'dark' ? 'dark' : 'light',
          }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 4 }}>Time</div>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{
            width: '100%', background: inputBg, color: T.ink,
            border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
            padding: '10px 11px', fontFamily: T.font, fontSize: 13, fontWeight: 500,
            outline: 'none', colorScheme: mode === 'dark' ? 'dark' : 'light',
          }} />
        </div>
      </div>

      <SectionLabel>Duration</SectionLabel>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: T.card, border: `1.5px solid ${T.cardBorder}`,
        borderRadius: 12, padding: '8px 10px', marginBottom: 10,
      }}>
        <button onClick={() => setDuration(Math.max(30, duration - 30))} style={{
          width: 34, height: 34, borderRadius: 10,
          background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : T.pinkTint,
          border: `1px solid ${T.cardBorder}`, color: T.pink,
          fontFamily: T.font, fontSize: 18, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>−</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, color: T.ink, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(duration)}</div>
          <div style={{ fontFamily: T.font, fontSize: 9.5, color: T.inkMuted, letterSpacing: '0.3px' }}>estimated</div>
        </div>
        <button onClick={() => setDuration(Math.min(480, duration + 30))} style={{
          width: 34, height: 34, borderRadius: 10,
          background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : T.pinkTint,
          border: `1px solid ${T.cardBorder}`, color: T.pink,
          fontFamily: T.font, fontSize: 18, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
      </div>

      {(aiEstimateLoading || (aiDuration && aiDuration !== duration)) && (
        <div style={{
          background: T.hero, borderRadius: 16, padding: '12px 14px', marginBottom: 14,
          position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ position: 'absolute', top: -30, right: -20, width: 90, height: 90, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{
            width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#FF5A9D,#E91E6A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
          }}>
            <span className={aiEstimateLoading ? 'sm-pulse' : ''} style={{ fontSize: 14, color: 'white' }}>✦</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 2 }}>
              {aiEstimateLoading ? 'Calculating Smart Estimate...' : 'Smart Estimate'}
            </div>
            {aiEstimateLoading ? (
              <div className="sm-pulse" style={{ fontFamily: T.font, fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Analyzing client history and notes...</div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ flex: 1, fontFamily: T.font, fontSize: 11.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
                  {aiEstimateReason || `Typically takes ${fmtDuration(aiDuration)} for this client.`}
                </div>
                <button
                  onClick={() => setDuration(aiDuration)}
                  style={{
                    background: '#E91E6A', color: 'white', border: 'none', borderRadius: 8,
                    padding: '6px 10px', fontFamily: T.font, fontSize: 10, fontWeight: 700,
                    cursor: 'pointer', position: 'relative', zIndex: 1, flexShrink: 0
                  }}
                >Use it</button>
              </div>
            )}
          </div>
        </div>
      )}

      <SectionLabel>Recurrence</SectionLabel>
      <div style={{ display: 'flex', background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : T.pinkTint, borderRadius: 10, padding: 3 }}>
        {RECURRENCE.map(r => {
          const on = r.key === recurrence;
          return (
            <button key={r.label} onClick={() => setRecurrence(r.key)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: on ? '#E91E6A' : 'transparent',
              fontFamily: T.font, fontSize: 11, fontWeight: 600,
              color: on ? 'white' : T.inkSub, cursor: 'pointer',
            }}>{r.label}</button>
          );
        })}
      </div>
    </>
  );
}

/* ============= STEP 3 ============= */
function Step3Review({
  T, mode, privacyOn, client, service, date, time, duration, recurrence, priceStr,
  conflicts, clientLookup, confirmText, setConfirmText,
}) {
  const timeRange = fmtTimeRange(time, duration);
  const dateObj = date ? new Date(`${date}T12:00:00`) : null;
  const dateLabel = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';

  return (
    <>
      <div style={{
        background: T.hero,
        border: '1.5px solid rgba(233,30,106,0.35)',
        borderBottom: '3px solid #E91E6A',
        borderRadius: 16, padding: '13px 14px 14px',
        position: 'relative', overflow: 'hidden', marginBottom: 12,
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 3 }}>{service?.label || 'Service'}</div>
              <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: 'white', letterSpacing: '-0.4px' }}>{client?.name || 'New client'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {privacyOn ? (
                <span style={{ fontFamily: T.font, fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '3px' }}>•••</span>
              ) : (
                <span style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: 'white', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{priceStr}</span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <InfoTile T={T} label="When"     value={dateLabel} sub={timeRange} />
            <InfoTile T={T} label="Duration" value={fmtDuration(duration)} sub="estimated" />
            <InfoTile T={T} label="Repeats"  value={recurrence ? (recurrence.charAt(0).toUpperCase() + recurrence.slice(1)) : 'One-time'} sub={recurrence ? '↻ auto-books' : 'single visit'} />
            <InfoTile T={T} label="Address"  value={client?.address ? client.address.split(',')[0] : '—'} sub={client?.address ? (client.address.split(',')[1] || '').trim() : ''} />
          </div>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div style={{
          background: mode === 'dark' ? 'rgba(245,158,11,0.11)' : '#FFFBEB',
          border: '1px solid rgba(245,158,11,0.35)',
          borderRadius: 12, padding: '10px 12px', marginBottom: 12,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 15 }}>⚠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.font, fontSize: 11.5, fontWeight: 700, color: '#F59E0B', marginBottom: 2 }}>
              {conflicts.length === 1 ? 'Tight gap detected' : `${conflicts.length} overlapping jobs`}
            </div>
            <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkSub, lineHeight: 1.4 }}>
              {conflicts.slice(0, 2).map(c => {
                const cClient = clientLookup(c.client_id);
                const t = new Date(c.scheduled_at);
                const tLabel = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                return `${cClient?.name || 'Job'} @ ${tLabel}`;
              }).join(' · ')} — non-blocking, book anyway?
            </div>
          </div>
        </div>
      )}

      <SectionLabel>Pre-flight</SectionLabel>
      <div style={{
        background: T.card, border: `1.5px solid ${T.cardBorder}`,
        borderRadius: 12, padding: '4px 12px', marginBottom: 10,
      }}>
        <ChecklistRow T={T} icon="📅" label="Google Calendar sync"  checked />
        <ChecklistRow T={T} icon="⏱"  label="Auto-timer on arrival" checked />
        <ChecklistRow T={T} icon="🚗" label="Mileage tracking"       checked />
        <ChecklistRow T={T} icon="💬" label="Confirmation text to client"
          checked={confirmText} onToggle={() => setConfirmText(v => !v)} />
      </div>
    </>
  );
}

function InfoTile({ T, label, value, sub }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 10, padding: '7px 9px',
    }}>
      <div style={{ fontFamily: T.font, fontSize: 8, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, color: 'white', letterSpacing: '-0.2px' }}>{value}</div>
      {sub && (<div style={{ fontFamily: T.font, fontSize: 9.5, color: 'rgba(255,255,255,0.48)', marginTop: 1 }}>{sub}</div>)}
    </div>
  );
}

function ChecklistRow({ T, icon, label, checked, onToggle }) {
  const interactive = !!onToggle;
  return (
    <button onClick={onToggle} disabled={!interactive} style={{
      width: '100%', background: 'transparent', border: 'none',
      padding: '9px 0', display: 'flex', alignItems: 'center', gap: 10,
      cursor: interactive ? 'pointer' : 'default',
      borderBottom: `1px solid ${T.cardBorder}`,
    }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ flex: 1, textAlign: 'left', fontFamily: T.font, fontSize: 11.5, fontWeight: 500, color: T.ink }}>{label}</span>
      <span style={{
        width: 18, height: 18, borderRadius: 5,
        background: checked ? '#22C55E' : 'transparent',
        border: `1.5px solid ${checked ? '#22C55E' : T.cardBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5L8.5 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
