import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useServices, useBusiness, notifyDataChanged } from '../../data/useData';
import { createJob, fetchActiveJobs, fetchJobsByClientId, findConflicts, composeTorontoISO } from '../../data/jobsRepo';
import { fetchClients } from '../../data/clientsRepo';
import { fetchWorkersWithSkills } from '../../data/workersRepo';
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
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';

function todayISODate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
}

// Format HH:MM → "10:30 AM"
function fmtTime12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Compute end time from start + duration minutes
function addMinutes(hhmm, mins) {
  if (!hhmm || !mins) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return fmtTime12(`${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`);
}

// Returns HH:MM string for use in <input type="time">
function toHHMMStr(startHHMM, mins) {
  if (!startHHMM || !mins) return '';
  const [h, m] = startHHMM.split(':').map(Number);
  const total = h * 60 + m + mins;
  if (total <= 0) return '';
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

// Returns minute diff between two HH:MM strings (null if invalid or negative)
function diffMinutes(startHHMM, endHHMM) {
  if (!startHHMM || !endHHMM) return null;
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff >= 15 ? diff : null;
}

export default function NewJobSheet({ prefillClientId, prefillData, onClose }) {
  const { T } = useAppTheme();
  const toast = useToast();
  const isKeyboardFocused = useKeyboardFocus();
  const { services } = useServices();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);
  const hasPrefill = (!!prefillClientId && prefillClientId !== 'null') || !!prefillData;
  const [step, setStep] = useState(() => hasPrefill ? 2 : 1);
  const { panelRef: swipePanelRef, scrollRef: swipeScrollRef, handlers: swipeHandlers } = useSwipeToDismiss(onClose);

  // Fetch clients + jobs + workers on mount
  const [clientRows, setClientRows] = useState([]);
  const [jobRows, setJobRows] = useState([]);
  const [clientJobs, setClientJobs] = useState([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [workerOptions, setWorkerOptions] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchClients(), fetchActiveJobs(), fetchWorkersWithSkills().catch(() => [])])
      .then(([cs, js, ws]) => {
        if (alive) {
          setClientRows(cs);
          setJobRows(js);
          setWorkerOptions(ws);
        }
      })
      .catch(console.error);
    return () => { alive = false; };
  }, []);

  const [clientId, setClientId] = useState(() => {
    if (prefillData?.client_id) return prefillData.client_id;
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
  const [serviceId, setServiceId] = useState(prefillData?.service_id || null);
  const [date, setDate] = useState(todayISODate());
  const [time, setTime] = useState(prefillData?.scheduled_time?.slice(0, 5) || '');

  const [duration, setDuration] = useState(prefillData?.estimated_hours ? prefillData.estimated_hours * 60 : null);
  const [durationTouched, setDurationTouched] = useState(!!prefillData?.estimated_hours);
  const [recurrence, setRecurrence] = useState(prefillData?.recurrence || null);
  const [additionalCosts, setAdditionalCosts] = useState([{ amount: '', description: '' }]);
  const [customPrice, setCustomPrice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bookErr, setBookErr] = useState('');
  const [bookingNotes, setBookingNotes] = useState(prefillData?.job_notes || prefillData?.bookingNotes || '');
  const [takingChances, setTakingChances] = useState(false);
  const [pastConfirmed, setPastConfirmed] = useState(false);
  const [workerId, setWorkerId] = useState(null);
  const [workerPay, setWorkerPay] = useState('');
  const [driveTime, setDriveTime] = useState(null);
  const [driveTimeLoading, setDriveTimeLoading] = useState(false);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const taxInitRef = useRef(false);
  useEffect(() => {
    if (!taxInitRef.current && business !== null && business !== undefined) {
      taxInitRef.current = true;
      setTaxEnabled(business.tax_enabled ?? false);
    }
  }, [business]);

  useEffect(() => {
    const dest = selectedClient?.address;
    if (!dest) { setDriveTime(null); return; }
    let cancelled = false;
    setDriveTimeLoading(true);
    setDriveTime(null);
    fetch(`/api/maps?type=distance&origins=${encodeURIComponent('Georgetown, ON, Canada')}&destinations=${encodeURIComponent(dest)}&departure_time=now&avoid=tolls`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const el = data?.rows?.[0]?.elements?.[0];
        setDriveTime(el?.status === 'OK' ? el.duration.text : null);
      })
      .catch(() => { if (!cancelled) setDriveTime(null); })
      .finally(() => { if (!cancelled) setDriveTimeLoading(false); });
    return () => { cancelled = true; };
  }, [selectedClient?.address]);

  const scheduledISO = useMemo(() => composeTorontoISO(date, time), [date, time]);
  const isPastBooking = useMemo(() => {
    if (!scheduledISO) return false;
    return new Date(scheduledISO) < new Date();
  }, [scheduledISO]);
  const conflicts = useMemo(() => {
    if (!scheduledISO) return [];
    return findConflicts(jobRows, scheduledISO, duration, 60);
  }, [jobRows, scheduledISO, duration]);

  // Most common scheduled_time from this client's past jobs
  const suggestedTime = useMemo(() => {
    if (!clientJobs.length) return null;
    const counts = {};
    clientJobs.forEach(j => {
      const t = j.scheduled_time?.slice(0, 5);
      if (t) counts[t] = (counts[t] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] >= 2 ? top[0] : null; // only suggest if seen 2+ times
  }, [clientJobs]);

  const [aiDuration, setAiDuration] = useState(null);
  const [aiEstimateLoading, setAiEstimateLoading] = useState(false);
  const [aiEstimateReason, setAiEstimateReason] = useState('');

  // Auto-select recurrence from client usual if available
  const [lastClientRefId, setLastClientRefId] = useState(null);
  if (selectedClient && selectedClient.id !== lastClientRefId) {
    setLastClientRefId(selectedClient.id);
    // Don't overwrite if we have specific prefillData for a duplication
    if (!prefillData && selectedClient.recurrence) setRecurrence(selectedClient.recurrence);
  }

  const onPickService = async (id) => {
    setServiceId(id);
    setCustomPrice(null);
    setAdditionalCosts([{ amount: '', description: '' }]);
    const svc = services.find(s => s.id === id);
    if (!svc) return;

    // 1. Local deterministic estimate
    const localEstimate = calculateEstimatedDuration(selectedClient, svc.name, services);
    setAiDuration(localEstimate !== Number(svc.default_duration) ? localEstimate : null);
    if (!durationTouched) setDuration(snapToHalfHour(localEstimate || Number(svc.default_duration) || 120));

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
            setDuration(snapToHalfHour(smart.duration_minutes));
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
    if (!clientId || !serviceId) {
      setBookErr('Client and Service are required.');
      return;
    }
    if (!duration) {
      setBookErr('Please set an estimated duration.');
      return;
    }
    if (isPastBooking && !pastConfirmed) {
      setBookErr("This job is scheduled in the past — please confirm below.");
      return;
    }
    if (conflicts.length > 0 && !takingChances) {
      setBookErr("There's a scheduling conflict — please confirm below.");
      return;
    }

    setBusy(true); setBookErr('');
    try {
      const svc = services.find(s => s.id === serviceId);
      const pricingType = svc?.pricing_type || 'Flat';
      const defaultRate = svc?.use_business_default
        ? (business?.hourly_rate || 0)
        : (Number(svc?.default_price) || 0);
      const serviceRate = customPrice !== null ? Number(customPrice) : defaultRate;
      const estimatedHours = Math.round((duration / 60) * 100) / 100;
      const totalAmount = pricingType === 'Hourly'
        ? serviceRate * estimatedHours
        : serviceRate;

      const validCosts = additionalCosts
        .filter(c => parseFloat(c.amount) > 0)
        .map(c => ({ amount: parseFloat(c.amount), description: c.description }));

      const payload = {
        client_id: clientId,
        service_id: serviceId,
        service_name: svc?.name,
        scheduled_date: date,
        scheduled_time: time,
        estimated_hours: estimatedHours,
        pricing_type: pricingType,
        flat_rate: serviceRate,
        total_amount: totalAmount,
        job_notes: bookingNotes,
        additional_costs_json: validCosts,
        additional_cost: validCosts.reduce((s, c) => s + c.amount, 0),
        worker_id: workerId || null,
        worker_pay: workerId && workerPay !== '' ? Number(workerPay) : null,
        tax_enabled: taxEnabled,
        ...(recurrence ? { ai_context: { recurrence_rule: recurrence } } : {}),
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
      <div ref={swipePanelRef} {...swipeHandlers} style={{
        background: T.bg, width: '100%', maxWidth: 500, margin: '0 auto',
        height: '92svh', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'njSlide 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
      }}>
        <GrabBar onDismiss={onClose} />

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {[1, 2, 3].map(n => (
                <div key={n} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: n < step ? T.green : n === step ? T.pink : T.cardBorder,
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>
              {step === 1 ? 'Who is it for?' : step === 2 ? 'Mission Details' : 'Review & Confirm'}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.07)', border: `1.5px solid rgba(0,0,0,0.08)`, color: T.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div ref={swipeScrollRef} className="sm-scroll" style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: `20px 20px ${isKeyboardFocused ? '140px' : '20px'}`,
        }}>
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
              suggestedTime={suggestedTime}
              business={business}
              customPrice={customPrice}
              setCustomPrice={setCustomPrice}
              additionalCosts={additionalCosts}
              setAdditionalCosts={setAdditionalCosts}
              workers={workerOptions}
              workerId={workerId}
              setWorkerId={setWorkerId}
              workerPay={workerPay}
              setWorkerPay={setWorkerPay}
              taxEnabled={taxEnabled}
              setTaxEnabled={setTaxEnabled}
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
              conflicts={conflicts}
              takingChances={takingChances}
              setTakingChances={setTakingChances}
              isPastBooking={isPastBooking}
              pastConfirmed={pastConfirmed}
              setPastConfirmed={setPastConfirmed}
              customPrice={customPrice}
              additionalCosts={additionalCosts}
              workers={workerOptions}
              workerId={workerId}
              workerPay={workerPay}
              taxEnabled={taxEnabled}
              driveTime={driveTime}
              driveTimeLoading={driveTimeLoading}
              T={T}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px 18px', borderTop: `1px solid ${T.cardBorder}`, background: T.bg }}>
          {bookErr && (
            <div style={{ paddingBottom: 8, color: '#EF4444', fontSize: 12, fontWeight: 500, textAlign: 'center' }}>{bookErr}</div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} style={{ flex: 1, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted, borderRadius: 12, padding: '12px 0', fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Back</button>
            )}
            <button
              type="button"
              onClick={step === 1 ? (clientId ? () => setStep(2) : () => {}) : step === 2 ? () => setStep(3) : handleBook}
              disabled={busy || (step === 1 && !clientId) || (step === 2 && (!serviceId || !duration || !time))}
              style={{
                flex: 2, borderRadius: 12, padding: '12px 0', border: 'none',
                fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: (busy || (step === 1 && !clientId) || (step === 2 && (!serviceId || !duration || !time))) ? T.pinkTint : T.pink,
                color: (busy || (step === 1 && !clientId) || (step === 2 && (!serviceId || !duration || !time))) ? T.inkMuted : 'white',
                boxShadow: '0 4px 12px rgba(233,30,106,0.3)',
              }}
            >
              {busy ? 'Booking...' : step < 3 ? 'Next' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      </div>

      {showNewClient && (
        <NewClientSheet
          onClose={() => setShowNewClient(false)}
          onCreated={(c) => {
            setClientId(c.id);
            setShowNewClient(false);
            setStep(2);
          }}
        />
      )}
    </div>
  );
}

function Step1Who({ clients, onPick, onNew, T }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return clients.filter(c => {
      const addr = [c.street, c.city, c.province, c.postal_code].filter(Boolean).join(', ');
      return (c.first_name + ' ' + c.last_name).toLowerCase().includes(s) ||
        addr.toLowerCase().includes(s);
    });
  }, [clients, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button type="button" onClick={onNew} style={{ width: '100%', padding: '14px', borderRadius: 12, background: T.pinkTint, border: `1.5px dashed ${T.pink}`, color: T.pink, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
        + New client
      </button>

      <div style={{ position: 'relative' }}>
        <input
          aria-label="Search clients"
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card, color: T.ink, fontSize: 14 }}
        />
      </div>

      <SectionLabel>Recent clients</SectionLabel>
      <div className="sm-scroll" style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          paddingBottom: 4, marginBottom: 14, marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4,
        }}>
          {clients.slice(0, 5).map(c => (
            <button key={c.id} type="button" onClick={() => onPick(c.id)} style={{ minWidth: 80, textAlign: 'center', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: T.font }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.pinkTint, border: `1.5px solid ${T.pink}`, margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {(c.first_name || c.last_name || '?')[0].toUpperCase()}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.first_name}</div>
            </button>
          ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(c => (
          <button key={c.id} type="button" onClick={() => onPick(c.id)} style={{ width: '100%', textAlign: 'left', padding: '12px', borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}`, cursor: 'pointer', fontFamily: T.font }}>
            <div style={{ fontWeight: 700, color: T.ink, fontSize: 14 }}>{c.first_name} {c.last_name}</div>
            <div style={{ fontSize: 11, color: T.inkMuted }}>{[c.street, c.city, c.province, c.postal_code].filter(Boolean).join(', ') || 'No address'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Suggested durations come from raw historical/AI minute values (e.g. 73) — snap them
// to the nearest half hour so the picker stays in the same clean increments as the +/- stepper.
function snapToHalfHour(mins) {
  return Math.max(30, Math.round(mins / 30) * 30);
}

function fmtMins(min) {
  if (!min) return '0 hrs';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? '1 hr' : `${h} hrs`;
  if (m === 30) return h === 1 ? '1½ hrs' : `${h}½ hrs`;
  return `${h}h ${m}m`;
}

function Step2What({
  selectedClient, services, serviceId, onPickService,
  date, setDate, time, setTime, duration, setDuration,
  recurrence, setRecurrence, notes, setNotes,
  aiDuration, aiLoading, aiReason, suggestedTime,
  business, customPrice, setCustomPrice, additionalCosts, setAdditionalCosts,
  workers, workerId, setWorkerId, workerPay, setWorkerPay,
  taxEnabled, setTaxEnabled,
  T
}) {
  const selectedSvc = services.find(s => s.id === serviceId);

  // Re-run worker pay auto-fill when service changes (worker already selected)
  useEffect(() => {
    if (!workerId || !workers?.length) return;
    const w = workers.find(x => x.id === workerId);
    if (!w?.skills?.length) return;
    const svcName = (selectedSvc?.name || '').toLowerCase();
    if (!svcName) return;
    const match = w.skills.find(sk =>
      svcName.includes(sk.skill_name.toLowerCase()) || sk.skill_name.toLowerCase().includes(svcName)
    );
    if (match?.pay_rate != null) setWorkerPay(String(match.pay_rate));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);
  const defaultRate = selectedSvc
    ? (selectedSvc.use_business_default ? (business?.hourly_rate || 0) : (Number(selectedSvc.default_price) || 0))
    : 0;
  const effectiveRate = customPrice !== null && customPrice !== '' ? Number(customPrice) : defaultRate;

  const liveBreakdown = selectedSvc ? {
    pricing_type: selectedSvc.pricing_type || 'Flat',
    flat_rate: effectiveRate,
    estimated_hours: (duration || 0) / 60,
    hourly_rate: effectiveRate,
    tax_enabled: taxEnabled,
    additional_costs_json: additionalCosts
      .filter(c => parseFloat(c.amount) > 0)
      .map(c => ({ amount: parseFloat(c.amount), description: c.description })),
  } : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Client Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: T.card, borderRadius: 16, border: `1px solid ${T.cardBorder}` }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.pink, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
          {selectedClient?.name?.[0]}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{selectedClient?.name}</div>
          <div style={{ fontSize: 11, color: T.inkMuted }}>{selectedClient?.address || 'No address'}</div>
        </div>
      </div>

      {/* Service Selection */}
      <div>
        <SectionLabel>Service</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {services.map(s => {
            const svcRate = s.use_business_default
              ? (business?.hourly_rate || 0)
              : (Number(s.default_price) || 0);
            const rateLabel = s.pricing_type === 'Hourly' ? `$${svcRate}/hr` : `$${svcRate} flat`;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPickService(s.id)}
                style={{
                  padding: '10px 10px 8px', borderRadius: 12,
                  background: serviceId === s.id ? T.pinkTint : T.card,
                  border: `1.5px solid ${serviceId === s.id ? T.pink : T.cardBorder}`,
                  cursor: 'pointer', textAlign: 'center',
                  width: '100%', fontFamily: T.font,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: serviceId === s.id ? T.pink : T.ink }}>{s.name}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: serviceId === s.id ? T.pink : T.inkMuted, marginTop: 2 }}>{rateLabel}</div>
              </button>
            );
          })}
        </div>

        {/* Custom price override */}
        {serviceId && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.inkMuted, fontSize: 13 }}>$</span>
              <input
                type="number"
                value={customPrice ?? ''}
                onChange={e => setCustomPrice(e.target.value === '' ? null : e.target.value)}
                placeholder={`Custom price (default: $${defaultRate})`}
                style={{ width: '100%', padding: '10px 12px 10px 26px', borderRadius: 10, background: T.card, border: `1px solid ${customPrice !== null ? T.pink : T.cardBorder}`, color: T.ink, fontSize: 13 }}
              />
            </div>
            {customPrice !== null && (
              <button onClick={() => setCustomPrice(null)} style={{ background: 'none', border: 'none', color: T.inkMuted, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Reset</button>
            )}
          </div>
        )}
        {serviceId && customPrice !== null && (
          <div style={{ fontSize: 10, color: T.pink, marginTop: 4, paddingLeft: 2 }}>Custom price active for this job only</div>
        )}
      </div>

      {/* Date */}
      <div>
        <SectionLabel>When</SectionLabel>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 14 }} />
      </div>

      {/* Start & End Time */}
      <div>
        <SectionLabel>Time</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 18px 1fr', alignItems: 'end', gap: 4 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.inkMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Start</div>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ width: '100%', padding: '10px 8px', borderRadius: 12, background: T.card, border: `1.5px solid ${time ? T.cardBorder : T.pink}`, color: T.ink, fontSize: 14 }} />
          </div>
          <div style={{ textAlign: 'center', color: T.inkMuted, fontSize: 13, paddingBottom: 10 }}>→</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.inkMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>End</div>
            <input
              type="time"
              value={toHHMMStr(time, duration)}
              disabled={!time}
              onChange={e => {
                const mins = diffMinutes(time, e.target.value);
                if (mins != null) setDuration(mins);
              }}
              style={{ width: '100%', padding: '10px 8px', borderRadius: 12, background: T.card, border: `1.5px solid ${T.cardBorder}`, color: T.ink, fontSize: 14, opacity: time ? 1 : 0.4 }}
            />
          </div>
        </div>
        {suggestedTime && !time && (
          <button
            onClick={() => setTime(suggestedTime)}
            style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span style={{ fontSize: 10, color: T.pink, fontWeight: 700 }}>Usually {fmtTime12(suggestedTime)}</span>
            <span style={{ fontSize: 10, color: T.inkMuted }}>— tap to use</span>
          </button>
        )}
      </div>

      {/* Duration Stepper */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <SectionLabel style={{ marginBottom: 0 }}>Estimated Duration</SectionLabel>
          {aiLoading ? (
            <span style={{ fontSize: 10, color: T.pink, fontWeight: 600 }}>Calculating…</span>
          ) : aiDuration && duration ? (
            <div style={{ fontSize: 10, color: '#059669', background: '#D1FAE5', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>AI Suggested</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            aria-label="Decrease duration"
            onClick={() => setDuration(d => Math.max(30, (d || 30) - 30))}
            style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.ink, fontSize: 20, fontWeight: 600, cursor: 'pointer' }}
          >–</button>
          <div style={{ flex: 1, textAlign: 'center', background: T.card, border: `1.5px solid ${duration ? T.cardBorder : T.pink}`, borderRadius: 12, padding: '10px 0' }}>
            {duration
              ? <div style={{ fontSize: 16, fontWeight: 700, color: T.pink }}>{fmtMins(duration)}</div>
              : <div style={{ fontSize: 13, fontWeight: 500, color: T.inkMuted }}>Tap + to set duration</div>
            }
          </div>
          <button
            type="button"
            aria-label="Increase duration"
            onClick={() => setDuration(d => (d || 0) + 30)}
            style={{ width: 44, height: 44, borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.ink, fontSize: 20, fontWeight: 600, cursor: 'pointer' }}
          >+</button>
        </div>
        {aiReason && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(233,30,106,0.07)', border: `1px solid ${T.pinkBorder}`, borderRadius: 8, fontSize: 11, color: T.inkMuted, fontStyle: 'italic' }}>
            "{aiReason}"
          </div>
        )}
      </div>

      {/* Additional Costs */}
      <div>
        <SectionLabel>Additional Costs</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {additionalCosts.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', width: 90 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.inkMuted, fontSize: 12 }}>$</span>
                <input
                  type="number"
                  value={c.amount}
                  onChange={e => {
                    const next = [...additionalCosts];
                    next[i] = { ...next[i], amount: e.target.value };
                    setAdditionalCosts(next);
                  }}
                  placeholder="0"
                  style={{ width: '100%', padding: '10px 10px 10px 22px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 13 }}
                />
              </div>
              <input
                value={c.description}
                onChange={e => {
                  const next = [...additionalCosts];
                  next[i] = { ...next[i], description: e.target.value };
                  setAdditionalCosts(next);
                }}
                placeholder="e.g. Supplies, Parking"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 13 }}
              />
              {additionalCosts.length > 1 && (
                <button onClick={() => setAdditionalCosts(additionalCosts.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 18, cursor: 'pointer' }}>×</button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAdditionalCosts([...additionalCosts, { amount: '', description: '' }])}
            style={{ background: 'none', border: 'none', color: T.pink, fontSize: 11, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', padding: '4px 0' }}
          >
            + Add another cost
          </button>
        </div>
      </div>

      {/* Live Financial Breakdown */}
      {liveBreakdown && (
        <FinancialMathBreakdown
          liveForm={liveBreakdown}
          business={business}
          T={T}
        />
      )}

      {/* HST toggle — only when business has HST enabled globally */}
      {business?.tax_enabled && liveBreakdown && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.card, padding: '12px 16px', borderRadius: 14, border: `1px solid ${T.cardBorder}` }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Charge HST</div>
            <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 2 }}>{taxEnabled ? 'HST will be added to this job' : 'No HST on this job'}</div>
          </div>
          <button type="button" role="switch" aria-checked={taxEnabled} onClick={() => setTaxEnabled(v => !v)} style={{ width: 44, height: 26, borderRadius: 13, background: taxEnabled ? T.pink : T.inkMuted, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, left: taxEnabled ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', display: 'block' }} />
          </button>
        </div>
      )}

      {/* Recurrence */}
      <div>
        <SectionLabel>Recurrence</SectionLabel>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { id: null, label: 'Once' },
            { id: 'Weekly', label: 'Weekly' },
            { id: 'Biweekly', label: 'Every 2 wks' },
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
          style={{ width: '100%', height: 80, padding: '12px', borderRadius: 12, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 13, resize: 'none', fontFamily: T.font }}
        />
      </div>

      {/* Assign Worker / Staff */}
      {workers && workers.length > 0 && (
        <div>
          <SectionLabel>Assign Team Member (optional)</SectionLabel>
          <select
            value={workerId || ''}
            onChange={e => {
              const wid = e.target.value || null;
              setWorkerId(wid);
              if (!wid) { setWorkerPay(''); return; }
              const w = workers.find(x => x.id === wid);
              if (w?.skills?.length > 0) {
                const svcName = (selectedSvc?.name || '').toLowerCase();
                const match = svcName ? w.skills.find(sk =>
                  svcName.includes(sk.skill_name.toLowerCase()) || sk.skill_name.toLowerCase().includes(svcName)
                ) : null;
                setWorkerPay(match?.pay_rate != null ? String(match.pay_rate) : '');
              } else {
                setWorkerPay('');
              }
            }}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: T.card, border: `1px solid ${workerId ? T.pink : T.cardBorder}`, color: T.ink, fontSize: 13, fontFamily: T.font }}
          >
            <option value="">— Unassigned —</option>
            {workers.filter(w => (w.person_type || 'worker') === 'worker').length > 0 && (
              <optgroup label="── Sidekicks ──">
                {workers.filter(w => (w.person_type || 'worker') === 'worker').map(w => (
                  <option key={w.id} value={w.id}>{w.name}{w.skills?.length > 0 ? ` · ${w.skills.map(s => s.skill_name).join(', ')}` : ''}</option>
                ))}
              </optgroup>
            )}
            {workers.filter(w => w.person_type === 'staff').length > 0 && (
              <optgroup label="── Wingmoms ──">
                {workers.filter(w => w.person_type === 'staff').map(w => (
                  <option key={w.id} value={w.id}>{w.name}{w.skills?.length > 0 ? ` · ${w.skills.map(s => s.skill_name).join(', ')}` : ''}</option>
                ))}
              </optgroup>
            )}
          </select>
          {workerId && (
            <div style={{ marginTop: 8, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.inkMuted, fontSize: 13 }}>$</span>
              <input
                type="number"
                value={workerPay}
                onChange={e => setWorkerPay(e.target.value)}
                placeholder="Pay for this job"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 26px', borderRadius: 10, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink, fontSize: 13, fontFamily: T.font }}
              />
            </div>
          )}
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}

function Step3Review({
  selectedClient, services, serviceId,
  date, time, duration, recurrence, notes,
  business, conflicts = [], takingChances, setTakingChances,
  isPastBooking, pastConfirmed, setPastConfirmed,
  customPrice, additionalCosts,
  workers, workerId, workerPay,
  taxEnabled,
  driveTime, driveTimeLoading,
  T
}) {
  const assignedWorker = workers?.find(w => w.id === workerId) || null;
  const service = services.find(s => s.id === serviceId);
  const hasConflict = conflicts.length > 0;

  const startFmt = fmtTime12(time);
  const endFmt = addMinutes(time, duration);

  const defaultRate = service
    ? (service.use_business_default ? (business?.hourly_rate || 0) : (Number(service.default_price) || 0))
    : 0;
  const effectiveRate = customPrice !== null && customPrice !== '' ? Number(customPrice) : defaultRate;

  const liveBreakdown = service ? {
    pricing_type: service.pricing_type || 'Flat',
    flat_rate: effectiveRate,
    estimated_hours: (duration || 0) / 60,
    hourly_rate: effectiveRate,
    tax_enabled: taxEnabled,
    additional_costs_json: (additionalCosts || [])
      .filter(c => parseFloat(c.amount) > 0)
      .map(c => ({ amount: parseFloat(c.amount), description: c.description })),
  } : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Dark Hero Summary Section */}
      <div style={{ 
        padding: '20px', 
        background: 'var(--grad-hero)', 
        borderBottom: 'var(--border-hero)', 
        margin: '-20px -20px 10px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 16,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Radial glow */}
        <div style={{ position: 'absolute', top: -40, right: -20, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle,rgba(233,30,106,.22) 0%,transparent 70%)`, pointerEvents: 'none' }} />
        
        {/* Client + Service stacked */}
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'var(--pink-label)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px', marginBottom: 4 }}>Booking For</div>
          <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, color: 'white', lineHeight: 1.2 }}>{selectedClient?.name}</div>
          <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>{service?.name}</div>
        </div>

        {/* Date + time range on one row */}
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'var(--pink-label)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px', marginBottom: 4 }}>When</div>
          <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: 'white' }}>
            {date ? new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'America/Toronto' }).format(new Date(date + 'T12:00:00')) : '—'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginTop: 3, letterSpacing: '0.2px' }}>
            {startFmt}{endFmt ? <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}> – </span> : ''}{endFmt}
          </div>
        </div>

        {/* Recurrence */}
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'var(--pink-label)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px', marginBottom: 2 }}>Recurrence</div>
          <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: 'white' }}>{recurrence || 'One-time'}</div>
        </div>
        {assignedWorker && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 10 }}>
            <span style={{ fontSize: 16 }}>{assignedWorker.person_type === 'staff' ? '🌟' : '🦸'}</span>
            <div>
              <div style={{ fontSize: 10, color: 'var(--pink-label)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px', marginBottom: 1 }}>
                Assigned {assignedWorker.person_type === 'staff' ? 'Wingmom' : 'Sidekick'}
              </div>
              <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: 'white' }}>
                {assignedWorker.name}
                {workerPay !== '' && workerPay != null && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-ui)', fontWeight: 400, marginLeft: 6 }}>· ${Number(workerPay).toFixed(0)} pay</span>
                )}
              </div>
              {assignedWorker.skills?.length > 0 && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{assignedWorker.skills.map(s => s.skill_name).join(', ')}</div>
              )}
            </div>
          </div>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 10 }}>
          <span style={{ fontSize: 16 }}>🚗</span>
          <div>
            <div style={{ fontSize: 10, color: 'var(--pink-label)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px', marginBottom: 1 }}>Drive to {selectedClient?.raw?.first_name || selectedClient?.name}</div>
            <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: driveTime ? 'white' : 'rgba(255,255,255,0.45)', fontStyle: driveTime ? 'normal' : 'italic' }}>
              {driveTimeLoading ? 'Calculating…' : driveTime ? `~${driveTime} from home` : selectedClient?.address ? 'Unable to calculate' : 'No address on file'}
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>Review Details</SectionLabel>

      {isPastBooking && (
        <div style={{
          padding: '14px', borderRadius: 16, background: '#FEF2F2',
          border: '1.5px solid #EF4444', display: 'flex', flexDirection: 'column', gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⏪</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>This date is in the past</div>
          </div>
          <div style={{ fontSize: 12, color: '#991B1B', opacity: 0.9, lineHeight: 1.4 }}>
            You're booking a job on a date that's already passed. This is allowed (e.g. logging a job after the fact), but double-check the date.
          </div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, marginTop: 4,
            padding: '10px', background: 'white', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${pastConfirmed ? '#EF4444' : '#FECACA'}`
          }}>
            <input
              type="checkbox"
              checked={pastConfirmed}
              onChange={e => setPastConfirmed(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#EF4444' }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#991B1B' }}>
              Yes, I know — book it anyway.
            </span>
          </label>
        </div>
      )}

      {hasConflict && (
        <div style={{
          padding: '14px', borderRadius: 16, background: 'var(--amber-light)',
          border: '1.5px solid var(--amber)', display: 'flex', flexDirection: 'column', gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber-text)' }}>Scheduling Conflict</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--amber-text)', opacity: 0.9, lineHeight: 1.4 }}>
            Another mission overlaps or is too close to this time. You may not have enough travel time between them.
          </div>

          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, marginTop: 4,
            padding: '10px', background: 'white', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${takingChances ? 'var(--amber)' : 'var(--amber-light)'}`
          }}>
            <input
              type="checkbox"
              checked={takingChances}
              onChange={e => setTakingChances(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--amber)' }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber-text)' }}>
              Book it anyway — I know the schedule.
            </span>
          </label>
        </div>
      )}

      {liveBreakdown && (
        <FinancialMathBreakdown
          liveForm={liveBreakdown}
          business={business}
          T={T}
        />
      )}
      
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
