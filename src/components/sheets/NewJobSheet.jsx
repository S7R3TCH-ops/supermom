import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useServices, useBusiness, notifyDataChanged } from '../../data/useData';
import { createJob, fetchActiveJobs, fetchJobsByClientId } from '../../data/jobsRepo';
import { fetchClients } from '../../data/clientsRepo';
import { toDisplayClient } from '../../data/selectors';
import { useToast } from '../../context/ToastContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { SectionLabel } from '../ui/typography';
import NewClientSheet from './NewClientSheet';
import { calculateEstimatedDuration } from '../../data/ai';
import { fetchSmartDurationEstimate } from '../../data/ai';
import { useKeyboardFocus } from '../../hooks/useKeyboardFocus';
import GrabBar from '../ui/GrabBar';
import FinancialMathBreakdown from '../ui/FinancialMathBreakdown';

function todayISODate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
}

export default function NewJobSheet({ prefillClientId, onClose }) {
  const { T } = useAppTheme();
  const toast = useToast();
  const isKeyboardFocused = useKeyboardFocus();
  const { services } = useServices();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);
  const hasPrefill = !!prefillClientId && prefillClientId !== 'null';
  const [step, setStep] = useState(() => hasPrefill ? 2 : 1);

  // Fetch clients + jobs on mount
  const [clientRows, setClientRows] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [jobRows, setJobRows] = useState([]);
  const [clientJobs, setClientJobs] = useState([]);
  const [showNewClient, setShowNewClient] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchClients(), fetchActiveJobs()])
      .then(([cs, js]) => { 
        if (alive) { 
          setClientRows(cs); 
          setJobRows(js);
          console.log('NewJobSheet: jobRows fetched', js.length);
        } 
      })
      .catch(console.error);
    return () => { alive = false; };
  }, []);

  const [clientId, setClientId] = useState(() => {
    if (prefillClientId === 'null') return null;
    return prefillClientId || null;
  });

  const [prevClientId, setPrevClientId] = useState(clientId);
  if (clientId !== prevClientId) {
    setPrevClientId(clientId);
    if (!clientId) setClientJobs([]);
  }

  useEffect(() => {
    if (!clientId) return;
    fetchJobsByClientId(clientId).then(setClientJobs).catch(console.error);
  }, [clientId]);

  const selectedClient = useMemo(() => {
    if (!clientId) return null;
    const row = clientRows.find(r => r.id === clientId);
    if (!row) return null;
    return toDisplayClient(row, clientJobs);
  }, [clientId, clientRows, clientJobs]);

  const { business } = useBusiness();
  const [serviceId, setServiceId] = useState(null);
  const [date, setDate] = useState(todayISODate());
  const [time, setTime] = useState('10:00');

  const [duration, setDuration] = useState(120);
  const [durationTouched, setDurationTouched] = useState(false);
  const [recurrence, setRecurrence] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bookErr, setBookErr] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');

  const [aiDuration, setAiDuration] = useState(null);
  const [aiEstimateLoading, setAiEstimateLoading] = useState(false);
  const [aiEstimateReason, setAiEstimateReason] = useState('');

  // Auto-select recurrence from client usual if available
  const [lastClientRefId, setLastClientRefId] = useState(null);
  if (selectedClient && selectedClient.id !== lastClientRefId) {
    setLastClientRefId(selectedClient.id);
    if (selectedClient.recurrence) setRecurrence(selectedClient.recurrence);
  }

  const onPickService = async (id) => {
    setServiceId(id);
    const svc = services.find(s => s.id === id);
    if (!svc) return;

    // 1. Local deterministic estimate
    const localEstimate = calculateEstimatedDuration(selectedClient, svc.name, services);
    setAiDuration(localEstimate !== Number(svc.default_duration) ? localEstimate : null);
    if (!durationTouched) setDuration(localEstimate || Number(svc.default_duration) || 120);

    // 2. Fetch AI smart estimate
    if (selectedClient?.id) {
      setAiEstimateLoading(true);
      setAiEstimateReason('');
      try {
        const smart = await fetchSmartDurationEstimate(selectedClient.id, svc.name, business);
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

  const handleBook = async () => {
    if (!clientId || !serviceId) return;
    setBusy(true); setBookErr('');
    try {
      const payload = {
        client_id: clientId,
        service_id: serviceId,
        scheduled_at: `${date}T${time}:00`,
        duration_est: duration / 60,
        recurrence: recurrence,
        notes: bookingNotes,
      };
      await createJob(payload);
      notifyDataChanged();
      toast.success('Mission Booked! 🚀');
      onClose();
    } catch (e) {
      setBookErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Book a mission" style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(4,1,12,0.65)',
      animation: 'njFade 180ms ease-out',
    }}>
      <style>{`
        @keyframes njFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes njSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      <div style={{
        background: T.bg, width: '100%', maxWidth: 500, margin: '0 auto',
        height: '92svh', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'njSlide 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
      }}>
        <GrabBar />

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <SectionLabel serif={false} style={{ marginBottom: 4 }}>Booking: Step {step} of 3</SectionLabel>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>
              {step === 1 ? 'Who is it for?' : step === 2 ? 'Mission Details' : 'Review & Confirm'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: T.inkMuted, cursor: 'pointer' }}>×</button>
        </div>

        <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {step === 1 ? (
            <Step1Who 
              clients={clientRows} 
              onPick={id => { setClientId(id); setStep(2); }} 
              onNew={() => setShowNewClient(true)}
              T={T}
            />
          ) : step === 2 ? (
            <Step2What
              selectedClient={selectedClient}
              services={services}
              serviceId={serviceId}
              onPickService={onPickService}
              date={date}
              setDate={setDate}
              time={time}
              setTime={setTime}
              duration={duration}
              setDuration={(d) => { setDuration(d); setDurationTouched(true); }}
              recurrence={recurrence}
              setRecurrence={setRecurrence}
              notes={bookingNotes}
              setNotes={setBookingNotes}
              aiDuration={aiDuration}
              aiLoading={aiEstimateLoading}
              aiReason={aiEstimateReason}
              business={business}
              T={T}
            />
          ) : (
            <Step3Review
              selectedClient={selectedClient}
              services={services}
              serviceId={serviceId}
              date={date}
              time={time}
              duration={duration}
              recurrence={recurrence}
              notes={bookingNotes}
              business={business}
              T={T}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px 18px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 10, background: T.bg }}>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} style={{ flex: 1, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted, borderRadius: 12, padding: '12px 0', fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Back</button>
          )}
          <button 
            onClick={step === 1 ? (clientId ? () => setStep(2) : () => {}) : step === 2 ? () => setStep(3) : handleBook} 
            disabled={busy || (step === 1 && !clientId) || (step === 2 && !serviceId)} 
            style={{ 
              flex: 2, background: (busy || (step === 1 && !clientId) || (step === 2 && !serviceId)) ? T.pinkTint : '#E91E6A', 
              color: 'white', border: 'none', borderRadius: 12, padding: '12px 0', 
              fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: 'pointer', 
              boxShadow: '0 4px 12px rgba(233,30,106,0.3)' 
            }}
          >
            {busy ? 'Booking...' : step < 3 ? 'Next' : 'Confirm Booking'}
          </button>
        </div>
        
        {bookErr && <div style={{ padding: '0 20px 10px', color: '#EF4444', fontSize: 11, textAlign: 'center' }}>{bookErr}</div>}
        
        <div style={{ height: isKeyboardFocused ? 260 : 0, transition: 'height 0.2s ease-out' }} />
      </div>

      <NewClientSheet isOpen={showNewClient} onClose={() => setShowNewClient(false)} />
    </div>
  );
}

function Step1Who({ clients, onPick, onNew, T }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return clients.filter(c => 
      (c.first_name + ' ' + c.last_name).toLowerCase().includes(s) ||
      (c.address || '').toLowerCase().includes(s)
    );
  }, [clients, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button onClick={onNew} style={{ width: '100%', padding: '14px', borderRadius: 12, background: T.pinkTint, border: `1.5px dashed ${T.pink}`, color: T.pink, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
        + NEW CLIENT
      </button>

      <div style={{ position: 'relative' }}>
        <input 
          placeholder="Search clients..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card, color: T.ink, fontSize: 14, outline: 'none' }} 
        />
      </div>

      <SectionLabel>Recent clients</SectionLabel>
      <div className="sm-scroll" style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          paddingBottom: 4, marginBottom: 14, marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4,
        }}>
          {clients.slice(0, 5).map(c => (
            <div key={c.id} onClick={() => onPick(c.id)} style={{ minWidth: 80, textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.pinkTint, border: `1.5px solid ${T.pink}`, margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {c.first_name?.[0]}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.first_name}</div>
            </div>
          ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(c => (
          <div key={c.id} onClick={() => onPick(c.id)} style={{ padding: '12px', borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}`, cursor: 'pointer' }}>
            <div style={{ fontWeight: 700, color: T.ink, fontSize: 14 }}>{c.first_name} {c.last_name}</div>
            <div style={{ fontSize: 11, color: T.inkMuted }}>{c.address || 'No address'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step2What({ 
  selectedClient, services, serviceId, onPickService, 
  date, setDate, time, setTime, duration, setDuration, 
  recurrence, setRecurrence, notes, setNotes,
  aiDuration, aiLoading, aiReason,
  business, T
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Client Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: T.card, borderRadius: 16, border: `1px solid ${T.cardBorder}` }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.pink, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
          {selectedClient?.firstName?.[0]}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{selectedClient?.firstName} {selectedClient?.lastName}</div>
          <div style={{ fontSize: 11, color: T.inkMuted }}>{selectedClient?.address || 'No address'}</div>
        </div>
      </div>

      <FinancialMathBreakdown
        job={{
          pricing_type: services.find(s => s.id === serviceId)?.pricing_type || 'Hourly',
          flat_rate: services.find(s => s.id === serviceId)?.use_business_default ? business?.hourly_rate : (services.find(s => s.id === serviceId)?.default_price || 0),
          estimated_hours: duration / 60
        }}
        actualMinutes={duration}
        business={business}
        T={T}
      />

      {/* Service Selection */}
      <div>
      <SectionLabel>Service</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {services.map(s => (
          <div 
            key={s.id} 
            onClick={() => onPickService(s.id)}
            style={{ 
              padding: '10px', borderRadius: 12, 
              background: serviceId === s.id ? T.pinkTint : T.card, 
              border: `1.5px solid ${serviceId === s.id ? T.pink : T.cardBorder}`,
              cursor: 'pointer', textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: serviceId === s.id ? T.pink : T.ink }}>{s.name}</div>
            <div style={{ fontSize: 9, color: T.inkMuted }}>{s.pricing_type}</div>
          </div>
        ))}
      </div>
      </div>

      {/* Date & Time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
        <div>
          <SectionLabel>When</SectionLabel>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 14, outline: 'none' }} />
        </div>
        <div>
          <SectionLabel>Time</SectionLabel>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 14, outline: 'none' }} />
        </div>
      </div>

      {/* Duration Slider */}
      <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SectionLabel style={{ marginBottom: 0 }}>Duration</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {aiLoading ? (
            <span style={{ fontSize: 10, color: T.pink, fontWeight: 600 }}>Calculating…</span>
          ) : aiDuration ? (
            <div style={{ fontSize: 10, color: '#059669', background: '#D1FAE5', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>AI Suggested</div>
          ) : null}
          <div style={{ fontSize: 14, fontWeight: 800, color: T.pink }}>{(duration / 60).toFixed(1)} hrs</div>
        </div>
      </div>
      
      <input 
        type="range" min="30" max="480" step="30" 
        value={duration} 
        onChange={e => setDuration(parseInt(e.target.value))} 
        style={{ width: '100%', accentColor: T.pink }}
      />
      
      {aiReason && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(233,30,106,0.05)', borderLeft: `3px solid ${T.pink}`, fontSize: 11, color: T.inkMuted, fontStyle: 'italic' }}>
          "{aiReason}"
        </div>
      )}
      </div>

      {/* Recurrence */}
      <div>
      <SectionLabel>Recurrence</SectionLabel>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { id: null, label: 'Once' },
          { id: 'Weekly', label: 'Weekly' },
          { id: 'Bi-weekly', label: 'Every 2 wks' },
          { id: 'Monthly', label: 'Monthly' },
        ].map(r => (
          <button
            key={String(r.id)}
            onClick={() => setRecurrence(r.id)}
            style={{
              padding: '8px 14px', borderRadius: 10, whiteSpace: 'nowrap',
              background: recurrence === r.id ? T.pink : T.card,
              border: `1px solid ${recurrence === r.id ? T.pink : T.cardBorder}`,
              color: recurrence === r.id ? 'white' : T.ink,
              fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      </div>

      {/* Notes */}
      <div>
      <SectionLabel>Notes for this job</SectionLabel>
      <textarea 
        placeholder="Specific instructions for this visit..." 
        value={notes}
        onChange={e => setNotes(e.target.value)}
        style={{ width: '100%', height: 80, padding: '12px', borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 13, outline: 'none', resize: 'none', fontFamily: T.font }} 
      />
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}

function Step3Review({ 
  selectedClient, services, serviceId, 
  date, time, duration, recurrence, notes, 
  business, T 
}) {
  const service = services.find(s => s.id === serviceId);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionLabel>Review Booking</SectionLabel>
      <div style={{ padding: '16px', background: T.card, borderRadius: 16, border: `1px solid ${T.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700 }}>Client</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{selectedClient?.firstName} {selectedClient?.lastName}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700 }}>Mission</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{service?.name}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700 }}>Date</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{date}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700 }}>Time</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{time}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700 }}>Recurrence</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{recurrence || 'One-time'}</div>
        </div>
      </div>

      <FinancialMathBreakdown
        job={{
          pricing_type: service?.pricing_type || 'Hourly',
          flat_rate: service?.use_business_default ? business?.hourly_rate : (service?.default_price || 0),
          estimated_hours: duration / 60
        }}
        actualMinutes={duration}
        business={business}
        T={T}
      />
      
      {notes && (
        <div>
          <SectionLabel>Notes</SectionLabel>
          <div style={{ padding: '12px', background: T.card, borderRadius: 12, border: `1px solid ${T.cardBorder}`, fontSize: 13, color: T.ink, fontStyle: 'italic' }}>
            "{notes}"
          </div>
        </div>
      )}
    </div>
  );
}
