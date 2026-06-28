import { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useAppTheme } from '../context/AppThemeContext';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { useNewJobSheet } from '../context/NewJobSheetContext';
import { useEditClientSheet } from '../context/EditClientSheetContext';
import { useToast } from '../context/ToastContext';
import AmtCell from '../components/ui/AmtCell';
import { Title, Subheading, Text, Caption, SectionLabel } from '../components/ui/typography';
import { useClient, useClientInvoices, notifyDataChanged } from '../data/useData';
import { simulateAILearning, updateClient, softDeleteClient, hardDeleteClient } from '../data/clientsRepo';
import { archiveClientJobs } from '../data/jobsRepo';
import { useAuth } from '../context/AuthContext';
import { EmptyActivity, EmptySchedule } from '../components/ui/Illustrations';

function formatPhone(p) {
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  if (digits.length !== 10) return p;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { T, mode, privacyOn } = useAppTheme();
  const { openFor } = useNewJobSheet();
  const { openJob } = useJobDetailSheet();
  const { open: openEditClient } = useEditClientSheet();
  const toast = useToast();
  const { client, raw, loading, error, refresh } = useClient(id);
  const { invoices: clientInvoices } = useClientInvoices(id);

  const [isSavingAi, setIsSavingAi] = useState(false);
  const [isEditingIntel, setIsEditingIntel] = useState(false);
  const [intelDraft, setIntelDraft] = useState({});

  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [dangerOpen, setDangerOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState(false);
  const [hardDeleteBusy, setHardDeleteBusy] = useState(false);

  const handleSimulateFuture = async () => {
    setIsSavingAi(true);
    try {
      await simulateAILearning(id, client.name);
      await refresh();
      notifyDataChanged();
    } catch (err) {
      console.error('Simulation failed:', err);
      toast.error('Simulation failed. Please try again.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleEditIntel = () => {
    setIntelDraft({
      notes:    client.note || '',
      prefs:    client.aiContext.prefs || '',
      access:   client.aiContext.access || '',
      comms:    client.aiContext.comms || '',
      personal: client.aiContext.personal || '',
    });
    setIsEditingIntel(true);
  };

  const handleSaveIntel = async () => {
    setIsSavingAi(true);
    try {
      await updateClient(id, {
        notes: intelDraft.notes,
        ai_context: {
          ...(raw?.ai_context || {}),
          prefs:    intelDraft.prefs,
          access:   intelDraft.access,
          comms:    intelDraft.comms,
          personal: intelDraft.personal,
        },
      });
      await refresh();
      setIsEditingIntel(false);
      notifyDataChanged();
    } catch (err) {
      console.error('Failed to save intel:', err);
      toast.error('Failed to save. Please try again.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleArchive = async () => {
    setArchiveBusy(true);
    try {
      await archiveClientJobs(id);
      await softDeleteClient(id);
      notifyDataChanged();
      navigate('/clients');
    } catch (err) {
      console.error('Archive failed:', err);
      toast.error('Archive failed. Please try again.');
      setArchiveBusy(false);
    }
  };

  const handleHardDelete = async () => {
    setHardDeleteBusy(true);
    try {
      await hardDeleteClient(id);
      notifyDataChanged();
      navigate('/clients');
    } catch (err) {
      console.error('Hard delete failed:', err);
      toast.error('Delete failed. Please try again.');
      setHardDeleteBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>
        Loading client…
      </div>
    );
  }
  if (error) {
    console.error('ClientProfile load error:', error);
    return (
      <div style={{ padding: 18, background: T.bg, color: T.ink }}>
        <div style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, padding: 12, fontFamily: T.font, fontSize: 13 }}>
          Couldn't load this client. Check your connection and try again.
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
      {/* Hero */}
      <div style={{
        background: T.hero, borderBottom: mode === 'dark' ? '3px solid #FC4693' : 'none',
        padding: '12px 14px 16px', position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 180, height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 65%)`,
          pointerEvents: 'none',
        }} />

        {/* Top row: back + label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, position: 'relative' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)'}`,
              borderRadius: 9, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
            }}
            aria-label="Back"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke={mode === 'dark' ? 'white' : T.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{
            fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px',
            textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink,
          }}>✦ Client Profile</div>
          <button
            onClick={() => openEditClient(id)}
            style={{
              background: mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)'}`,
              borderRadius: 9, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
            }}
            aria-label="Edit client"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={mode === 'dark' ? 'white' : T.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>

        {/* Avatar + name + tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, position: 'relative' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: 'linear-gradient(135deg,#FF5A9D,#FC4693)',
            border: '2px solid rgba(255,255,255,0.15)',
            boxShadow: '0 6px 16px rgba(233,30,106,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Title style={{ fontSize: 24, fontWeight: 500, color: 'white', margin: 0 }}>{client.init}</Title>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <Title 
              style={{ color: mode === 'dark' ? 'white' : T.ink, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {client.name}
            </Title>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {client.vip && (
                <span style={{
                  background: '#FCD34D', borderRadius: 5, padding: '2px 7px',
                }}>
                  <SectionLabel style={{ fontSize: 9, color: '#78350F', marginBottom: 0 }}>VIP ★</SectionLabel>
                </span>
              )}
              {recurrenceLabel && (
                <span style={{
                  background: mode === 'dark' ? 'rgba(255,255,255,0.13)' : 'rgba(233,30,106,0.1)', 
                  border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(233,30,106,0.2)'}`,
                  borderRadius: 5, padding: '2px 7px',
                }}>
                  <SectionLabel style={{ fontSize: 9, color: mode === 'dark' ? 'rgba(255,255,255,0.85)' : T.pink, marginBottom: 0 }}>↻ {recurrenceLabel}</SectionLabel>
                </span>
              )}
              {client.tags.includes('Lead') && (
                <span style={{
                  background: 'rgba(139,92,246,0.22)', border: '1px solid rgba(139,92,246,0.4)',
                  borderRadius: 5, padding: '2px 7px',
                }}>
                  <SectionLabel style={{ fontSize: 9, color: mode === 'dark' ? '#D8B4FE' : '#6D28D9', marginBottom: 0 }}>Lead</SectionLabel>
                </span>
              )}
              {client.tags.includes('⚠ Overdue') && (
                <span style={{
                  background: T.amberBg, borderRadius: 5, padding: '2px 7px',
                }}>
                  <SectionLabel style={{ fontSize: 9, color: T.amberFg, marginBottom: 0 }}>⚠ Overdue</SectionLabel>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3-stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8, position: 'relative' }}>
          {[
            { n: String(client.stats.jobsTotal), l: 'Jobs' },
            { n: privacyOn ? '•••' : `$${client.stats.revenueYtd.toLocaleString()}`, l: 'Revenue YTD' },
            { n: client.stats.lastVisit, l: 'Last visit' },
          ].map(s => (
            <div key={s.l} style={{
              background: mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
              borderRadius: 11, padding: '9px 6px', textAlign: 'center',
            }}>
              <Subheading style={{ fontSize: 16, fontWeight: 500, color: mode === 'dark' ? 'white' : T.ink, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums', margin: 0 }}>{s.n}</Subheading>
              <Caption style={{ fontSize: 9, fontWeight: 600, color: mode === 'dark' ? 'rgba(255,255,255,0.4)' : T.inkMuted, letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</Caption>
            </div>
          ))}
        </div>

        {/* LTV row */}
        {client.stats.totalBilled > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12, position: 'relative' }}>
            {[
              { n: privacyOn ? '•••' : `$${Math.round(client.stats.totalBilled).toLocaleString()}`, l: 'Total billed' },
              { n: privacyOn ? '•••' : `$${Math.round(client.stats.avgPerJob).toLocaleString()}`, l: 'Avg per job' },
            ].map(s => (
              <div key={s.l} style={{
                background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.25)',
                border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)'}`,
                borderRadius: 11, padding: '7px 6px', textAlign: 'center',
              }}>
                <Subheading style={{ fontSize: 14, fontWeight: 500, color: mode === 'dark' ? 'rgba(255,255,255,0.8)' : T.ink, letterSpacing: '-0.2px', fontVariantNumeric: 'tabular-nums', margin: 0 }}>{s.n}</Subheading>
                <Caption style={{ fontSize: 9, fontWeight: 600, color: mode === 'dark' ? 'rgba(255,255,255,0.35)' : T.inkMuted, letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</Caption>
              </div>
            ))}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <button
            onClick={() => openFor(client.id)}
            style={{
              flex: 2, background: T.pink, border: 'none', borderRadius: 12,
              padding: '11px 0', fontFamily: T.font, fontSize: 13, fontWeight: 700, color: 'white',
              cursor: 'pointer', letterSpacing: '0.2px',
            }}>Book Job</button>
          <button style={{
            flex: 1, 
            background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(233,30,106,0.08)', 
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(233,30,106,0.2)'}`,
            borderRadius: 12, padding: '11px 0',
            fontFamily: T.font, fontSize: 13, fontWeight: 600, 
            color: mode === 'dark' ? 'white' : T.pink, cursor: 'pointer',
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, position: 'relative' }}>
            <Caption style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px',
              textTransform: 'uppercase', color: '#FF78B0',
            }}>✦ What I know</Caption>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {!client.aiContext.learned && !isEditingIntel && (
                <button
                  onClick={handleSimulateFuture}
                  disabled={isSavingAi}
                  style={{
                    background: 'var(--grad-pink)', border: 'none', borderRadius: 8, padding: '4px 10px',
                    fontFamily: T.font, fontSize: 9, fontWeight: 700, color: 'white', cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(233,30,106,0.2)'
                  }}
                  title="Generate AI insights from past jobs"
                >
                  AI insights ✦
                </button>
              )}
              {!isEditingIntel ? (
                <button
                  onClick={handleEditIntel}
                  style={{ background: 'none', border: 'none', padding: 0, fontFamily: T.font, fontSize: 10, fontWeight: 600, color: T.pink, cursor: 'pointer' }}
                >Edit</button>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setIsEditingIntel(false)}
                    disabled={isSavingAi}
                    style={{ background: 'none', border: 'none', padding: 0, fontFamily: T.font, fontSize: 10, fontWeight: 600, color: T.inkMuted, cursor: 'pointer' }}
                  >Cancel</button>
                  <button
                    onClick={handleSaveIntel}
                    disabled={isSavingAi}
                    style={{ background: 'none', border: 'none', padding: 0, fontFamily: T.font, fontSize: 10, fontWeight: 700, color: T.pink, cursor: 'pointer' }}
                  >{isSavingAi ? 'Saving…' : 'Save'}</button>
                </div>
              )}
            </div>
          </div>
          {(() => {
            const fields = [
              { k: 'Notes',       f: 'notes',    v: client.note },
              { k: 'Preferences', f: 'prefs',    v: client.aiContext.prefs },
              { k: 'Access',      f: 'access',   v: client.aiContext.access },
              { k: 'Contact',     f: 'comms',    v: client.aiContext.comms },
              { k: 'Personal',    f: 'personal', v: client.aiContext.personal },
            ];
            const hasAnyContext = fields.some(r => r.v) || !!client.aiContext.learned;
            if (!hasAnyContext && !isEditingIntel) {
              return (
                <Text style={{ fontSize: 11.5, color: T.inkMuted, fontStyle: 'italic', lineHeight: 1.5 }}>
                  No notes yet. Tap Edit to add context about this client.
                </Text>
              );
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
                {fields.map(row => (isEditingIntel || row.v) && (
                  <div key={row.k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <Caption style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
                      textTransform: 'uppercase', color: T.inkMuted,
                      flexShrink: 0, width: 72, marginTop: isEditingIntel ? 6 : 2,
                    }}>{row.k}</Caption>
                    {isEditingIntel ? (
                      <textarea
                        value={intelDraft[row.f]}
                        onChange={e => setIntelDraft(d => ({ ...d, [row.f]: e.target.value }))}
                        placeholder={`Enter ${row.k.toLowerCase()}…`}
                        className="ai-intel-field"
                        style={{
                          flex: 1, background: T.pinkTint, border: `1px solid ${T.pinkBorder}`,
                          borderRadius: 8, padding: '4px 8px', fontFamily: T.font, fontSize: 11.5,
                          color: T.ink, minHeight: 44, resize: 'none',
                        }}
                      />
                    ) : (
                      <Text style={{ fontSize: 11.5, color: T.inkSub, lineHeight: 1.45, flex: 1 }}>
                        {row.v}
                      </Text>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {client.aiContext.learned && (
            <div style={{ 
              marginTop: 14, paddingTop: 12, 
              borderTop: `1px dashed ${T.cardBorder}`,
              position: 'relative'
            }}>
              <Caption style={{
                fontSize: 8.5, fontWeight: 700, letterSpacing: '1px',
                textTransform: 'uppercase', color: T.pink, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ fontSize: 10 }}>✦</span> AI Learned Intelligence
              </Caption>
              <div style={{
                fontFamily: T.font, fontSize: 11.5, color: T.ink, lineHeight: 1.5,
                background: T.pinkTint, borderRadius: 10, padding: '10px 12px',
                border: `1px solid ${T.pinkBorder}`, marginBottom: 10,
                fontStyle: 'italic'
              }}>
                "{client.aiContext.learned.synthesis_note}"
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {client.aiContext.learned.behavioral_flags.map((flag, i) => (
                  <span key={i} style={{
                    background: 'rgba(233,30,106,0.08)', border: `1px solid ${T.pinkBorder}`,
                    borderRadius: 6, padding: '3px 8px',
                    fontFamily: T.font, fontSize: 9, fontWeight: 600, color: T.pink,
                  }}>
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contact */}
        <SectionLabel>Contact</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {client.phone && (
            <ContactRow
              T={T}
              href={`tel:${client.phone}`}
              icon={<PhoneIcon />}
              label={formatPhone(client.phone)}
              sub="Tap to call"
            />
          )}
          {client.address && (
            <ContactRow
              T={T}
              href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`}
              icon={<PinIcon />}
              label={client.address}
              sub="Tap for directions"
            />
          )}
          {client.email && (
            <ContactRow
              T={T}
              href={`mailto:${client.email}`}
              icon={<MailIcon />}
              label={client.email}
              sub="Tap to email"
            />
          )}
        </div>

        {/* Upcoming */}
        <SectionLabel>Upcoming</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {client.upcoming.length === 0 ? (
            <div style={{
              background: T.card, border: `1.5px dashed ${T.cardBorder}`,
              borderRadius: 16, padding: '30px 20px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12
            }}>
              <EmptySchedule size={60} />
              <div style={{ fontFamily: T.font, fontSize: 11.5, color: T.inkMuted }}>
                No upcoming jobs booked
              </div>
              <button
                onClick={() => openFor(client.id)}
                style={{
                  background: T.pink, color: 'white', border: 'none', borderRadius: 8,
                  padding: '6px 14px', fontFamily: T.font, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>Book now</button>
            </div>
          ) : (
            client.upcoming.map((j, i) => (
              <button type="button" key={i} onClick={() => openJob(j.id)} style={{
                background: T.card, border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 13, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer', width: '100%', textAlign: 'left',
              }}>
                <div style={{
                  width: 50, flexShrink: 0, textAlign: 'center',
                  background: T.pinkTint, borderRadius: 10, padding: '6px 0', border: `1px solid ${T.pinkBorder}`,
                }}>
                  <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 900, color: T.pink, textTransform: 'uppercase', lineHeight: 1 }}>{j.date.split(' ')[0]}</div>
                  <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 700, color: T.pink, marginTop: 1 }}>{j.date.split(' ')[1]}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px' }}>{j.service}</div>
                  <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkSub, fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    {j.time}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                  <AmtCell amount={j.amt} size={14} />
                  <span style={{
                    background: T.pinkTint, color: T.pink,
                    borderRadius: 5, padding: '1px 6px',
                    fontFamily: T.font, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                  }}>Scheduled</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Recent history */}
        <SectionLabel>Recent history</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {client.history.length === 0 ? (
            <div style={{
              background: T.card, border: `1.5px solid ${T.cardBorder}`,
              borderRadius: 16, padding: '30px 20px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12
            }}>
              <EmptyActivity size={60} />
              <div style={{ fontFamily: T.font, fontSize: 11.5, color: T.inkMuted }}>
                No history yet.
              </div>
            </div>
          ) : (
            client.history.slice(0, 5).map((h, i) => (
              <button type="button" key={i} onClick={() => openJob(h.id)} style={{
                background: T.card, border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 13, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer', width: '100%', textAlign: 'left',
              }}>
                <div style={{
                  width: 50, flexShrink: 0, textAlign: 'center',
                  background: T.cardBorder, borderRadius: 10, padding: '6px 0',
                }}>
                  <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 900, color: T.inkSub, textTransform: 'uppercase', lineHeight: 1 }}>{h.date.split(' ')[0]}</div>
                  <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 700, color: T.inkSub, marginTop: 1 }}>{h.date.split(' ')[1]}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px' }}>{h.service}</div>
                  <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkMuted, marginTop: 2 }}>{h.duration}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <AmtCell amount={privacyOn ? '•••' : h.amt} size={13} color={h.status === 'paid' ? T.ink : h.status === 'partial' ? T.amberFg : T.pink} />
                  <span style={{
                    background: h.status === 'paid' ? T.greenBg : h.status === 'partial' ? T.amberBg : T.pinkTint,
                    color:      h.status === 'paid' ? T.greenFg : h.status === 'partial' ? T.amberFg : T.pink,
                    borderRadius: 5, padding: '1px 6px',
                    fontFamily: T.font, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                  }}>{h.status === 'paid' ? 'Paid ✓' : h.status === 'partial' ? 'Partial' : 'Unpaid'}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Invoices */}
        {clientInvoices.length > 0 && (
          <>
            <SectionLabel>Invoices</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {clientInvoices.map(inv => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => navigate(`/i/${inv.id}`)}
                  style={{
                    background: T.card, border: `1.5px solid ${T.cardBorder}`,
                    borderRadius: 13, padding: '10px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', width: '100%', textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 500, color: T.ink }}>#{inv.invoice_number}</div>
                    <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkMuted, marginTop: 2 }}>{inv.invoice_date}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {!privacyOn && (
                      <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: T.ink }}>
                        ${Number(inv.total_amount || 0).toFixed(2)}
                      </div>
                    )}
                    <span style={{
                      background: inv.status === 'Paid' ? T.greenBg : T.pinkTint,
                      color: inv.status === 'Paid' ? T.greenFg : T.pink,
                      borderRadius: 5, padding: '1px 6px',
                      fontFamily: T.font, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                    }}>{inv.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Admin Danger Zone */}
        {isAdmin && (
          <div style={{ margin: '8px 0 12px' }}>
            <button
              onClick={() => setDangerOpen(d => !d)}
              style={{
                width: '100%', background: 'transparent', border: `1px solid ${T.cardBorder}`,
                borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', fontFamily: T.font, fontSize: 11, fontWeight: 600, color: T.inkMuted,
              }}
            >
              <span>Admin Actions</span>
              <span style={{ fontSize: 10, transition: 'transform 0.2s', display: 'inline-block', transform: dangerOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>

            {dangerOpen && (
              <div style={{ marginTop: 6, background: mode === 'dark' ? 'rgba(176,21,80,0.08)' : '#FFF5F7', border: '1px solid rgba(176,21,80,0.25)', borderRadius: 10, padding: 12 }}>
                {!archiveConfirm ? (
                  <>
                    <div style={{ fontFamily: T.font, fontSize: 11, color: '#9B0D3A', marginBottom: 10, lineHeight: 1.5 }}>
                      Archiving removes this client and all their jobs from all views. This cannot be undone from the app.
                    </div>
                    <button
                      onClick={() => setArchiveConfirm(true)}
                      style={{
                        width: '100%', background: '#B01550', border: 'none', borderRadius: 9,
                        padding: '10px 0', fontFamily: T.font, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer',
                      }}
                    >
                      Archive Client &amp; All Jobs
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: T.font, fontSize: 12.5, fontWeight: 600, color: T.ink, marginBottom: 6 }}>
                      Archive <span style={{ fontFamily: T.serif }}>{client.name}</span> and {client?.stats?.jobsTotal ?? 0} job{(client?.stats?.jobsTotal ?? 0) !== 1 ? 's' : ''}?
                    </div>
                    <div style={{ fontFamily: T.font, fontSize: 11, color: T.inkMuted, marginBottom: 10 }}>
                      They will disappear from all views immediately.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setArchiveConfirm(false)}
                        disabled={archiveBusy}
                        style={{ flex: 1, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 9, padding: '9px 0', fontFamily: T.font, fontSize: 12.5, fontWeight: 600, color: T.inkSub, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleArchive}
                        disabled={archiveBusy}
                        style={{ flex: 1, background: '#B01550', border: 'none', borderRadius: 9, padding: '9px 0', fontFamily: T.font, fontSize: 12.5, fontWeight: 700, color: 'white', cursor: archiveBusy ? 'not-allowed' : 'default', opacity: archiveBusy ? 0.7 : 1 }}
                      >
                        {archiveBusy ? 'Archiving…' : 'Archive Everything'}
                      </button>
                    </div>
                  </>
                )}

                <div style={{ height: 1, background: 'rgba(127,29,29,0.2)', margin: '10px 0' }} />

                {!hardDeleteConfirm ? (
                  <>
                    <div style={{ fontFamily: T.font, fontSize: 11, color: '#7F1D1D', marginBottom: 10, lineHeight: 1.5 }}>
                      Permanently deletes this client and all their jobs from the database. Cannot be undone.
                    </div>
                    <button
                      onClick={() => setHardDeleteConfirm(true)}
                      style={{
                        width: '100%', background: '#7F1D1D', border: 'none', borderRadius: 9,
                        padding: '10px 0', fontFamily: T.font, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer',
                      }}
                    >
                      Permanently Delete Client + All Jobs
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: T.font, fontSize: 12.5, fontWeight: 600, color: T.ink, marginBottom: 6 }}>
                      Permanently delete <span style={{ fontFamily: T.serif }}>{client.name}</span> and all their jobs?
                    </div>
                    <div style={{ fontFamily: T.font, fontSize: 11, color: '#7F1D1D', marginBottom: 10, fontWeight: 600 }}>
                      This cannot be undone from anywhere.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setHardDeleteConfirm(false)}
                        disabled={hardDeleteBusy}
                        style={{ flex: 1, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 9, padding: '9px 0', fontFamily: T.font, fontSize: 12.5, fontWeight: 600, color: T.inkSub, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleHardDelete}
                        disabled={hardDeleteBusy}
                        style={{ flex: 1, background: '#7F1D1D', border: 'none', borderRadius: 9, padding: '9px 0', fontFamily: T.font, fontSize: 12.5, fontWeight: 700, color: 'white', cursor: hardDeleteBusy ? 'not-allowed' : 'default', opacity: hardDeleteBusy ? 0.7 : 1 }}
                      >
                        {hardDeleteBusy ? 'Deleting…' : 'Delete Forever'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

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
