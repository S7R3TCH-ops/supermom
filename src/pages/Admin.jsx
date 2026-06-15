import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../context/AppThemeContext';
import { useAuth } from '../context/AuthContext';
import { useJobs, useBusiness, useClients } from '../data/useData';
import { useToast } from '../context/ToastContext';
import { SectionLabel } from '../components/ui/typography';
import { useViewpoint } from '../context/ViewpointContext';
import { computeJobSubtotal } from '../lib/financialMath';
import ServiceCatalogSheet from '../components/sheets/ServiceCatalogSheet';
import WorkerCatalogSheet from '../components/sheets/WorkerCatalogSheet';

function ToggleBtn({ show, onToggle, color }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? 'Hide password' : 'Show password'}
      style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 4, color: color || 'var(--ink-muted)',
      }}
    >
      {show ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

export default function Admin() {
  const { T, mode } = useAppTheme();
  const toast = useToast();
  const { profile, signOut } = useAuth();
  const { business, loading: bizLoading, update: updateBiz } = useBusiness();
  const { clients, loading: clientsLoading } = useClients();
  const { jobs, loading: jobsLoading } = useJobs();
  const { isSuperAdmin, allBusinesses, switchTo, viewingAsId, reset, refresh } = useViewpoint();
  const navigate = useNavigate();

  // SECURITY: Redirect non-superadmins and non-owners back to home
  useEffect(() => {
    if (!bizLoading && profile !== null && !isSuperAdmin && profile?.role !== 'owner') {
      toast.error('Admin area is restricted to super admins.');
      navigate('/');
    }
  }, [bizLoading, profile, isSuperAdmin, navigate, toast]);

  const [isSaving, setIsSaving] = useState(false);
  const [pendingStyle, setPendingStyle] = useState(null);
  const [selectedBizId, setSelectedBizId] = useState('');
  const [showServices, setShowServices] = useState(false);
  const [showWorkers, setShowWorkers] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }
  const [restoreConfirm, setRestoreConfirm] = useState(null); // { id, name }

  // Clear pending style when business data actually updates to match - adjusting state during render
  if (pendingStyle && business?.ai_profile?.style === pendingStyle) {
    setPendingStyle(null);
  }

  const handleStyleChange = async (style) => {
    if (!business) return;
    setIsSaving(true);
    setPendingStyle(style);
    try {
      const newProfile = { ...(business?.ai_profile || {}), style };
      await updateBiz({ ai_profile: newProfile });
    } catch {
      setPendingStyle(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitch = () => {
    const biz = allBusinesses.find(b => b.id === selectedBizId);
    if (biz) switchTo(biz.id, biz.owner_name || biz.name);
  };

  const revenueYtd = (jobs || [])
    .filter(j => j.raw?.job_status === 'Completed')
    .reduce((sum, j) => sum + computeJobSubtotal(j), 0);

  const aiStyle = pendingStyle || business?.ai_profile?.style || 'professional';

  const [testResult, setTestResult] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const handleTestPersona = async () => {
    setIsTesting(true);
    setTestResult('');
    
    // Local fallback messages to ensure UI works even if API/network is down
    const fallbacks = {
      professional: "The spreadsheet of your life is balanced. Let's execute.",
      coach: "Breathe in the confidence, breathe out the chaos. You're a rockstar!",
      casual: "Alright, let's get this bread. Or at least get this organizing done so we can nap later."
    };

    try {
      const res = await fetch('/api/ai/test-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          style: aiStyle, 
          ownerName: business?.owner_name || profile?.first_name
        })
      });
      
      if (!res.ok) throw new Error(`Status ${res.status}`);
      
      const data = await res.json();
      if (data.message) {
        setTestResult(data.message);
        toast.info('Persona test ready.');
      } else {
        throw new Error('No message in response');
      }
    } catch {
      setTestResult(fallbacks[aiStyle] || fallbacks.professional);
    } finally {
      setIsTesting(false);
    }
  };

  const [pwForm, setPwForm] = useState({ pw: '', pw2: '' });
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState(null);

  const [provForm, setProvForm] = useState({ biz: '', owner: '', email: '', pw: '' });
  const [isProv, setIsProv] = useState(false);
  const [provMsg, setProvMsg] = useState('');

  // Block render until auth check is resolved — prevents UI flash for unauthorized users
  if (bizLoading || profile === null) return null;
  if (!isSuperAdmin && profile?.role !== 'owner') return null;

  const handleProvision = async () => {
    setIsProv(true); setProvMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/provision', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ businessName: provForm.biz, ownerName: provForm.owner, email: provForm.email, password: provForm.pw })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Business provisioned!');
      setProvMsg('Successfully provisioned! ✓');
      setProvForm({ biz: '', owner: '', email: '', pw: '' });
    } catch (e) {
      toast.error(e.message);
      setProvMsg(`Error: ${e.message}`);
    } finally {
      setIsProv(false);
    }
  };

  const handleSoftDeleteBiz = async (id) => {
    try {
      const { error } = await supabase.from('businesses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success('Business removed.');
      setDeleteConfirm(null);
      refresh();
    } catch(e) {
      toast.error(e.message);
    }
  };

  const handleRestoreBiz = async (id) => {
    try {
      const { error } = await supabase.from('businesses').update({ deleted_at: null }).eq('id', id);
      if (error) throw error;
      toast.success('Business restored.');
      setRestoreConfirm(null);
      refresh();
    } catch(e) {
      toast.error(e.message);
    }
  };

  const handleUpdatePassword = async () => {
    if (!pwForm.pw || pwForm.pw.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }
    if (pwForm.pw !== pwForm.pw2) {
      setPwError('Passwords do not match.');
      return;
    }
    setSavingPw(true);
    setPwError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.pw });
      if (error) throw error;
      toast.success('Password updated.');
      setPwSaved(true);
      setPwForm({ pw: '', pw2: '' });
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err) {
      const msg = err.message || 'Failed to update password.';
      toast.error(msg);
      setPwError(msg);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      {/* Hero */}
      <div style={{ 
        background: T.hero, 
        borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none', 
        padding: '13px 15px 15px', 
        position: 'relative', 
        overflow: 'hidden' 
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 180, height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 65%)`,
          pointerEvents: 'none',
        }} />

        <div style={{
          fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px',
          textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink, marginBottom: 10,
          position: 'relative'
        }}>✦ Business Admin</div>

        <h2 style={{ fontFamily: T.serif, fontSize: 24, margin: 0, color: mode === 'dark' ? 'white' : T.ink, position: 'relative' }}>
          {business?.name || profile?.business_name || 'Business Dashboard'}
        </h2>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        {isSuperAdmin && (
          <>
            {viewingAsId && (
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={reset}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12,
                    background: 'var(--pink)', color: 'white',
                    border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer'
                  }}
                >
                  ← Reset to My Real View
                </button>
              </div>
            )}
          </>
        )}

        {isSuperAdmin && !viewingAsId && (
          <>
            <SectionLabel>Super Admin: Viewpoint</SectionLabel>
            <div style={{
              background: 'var(--plum-dark)', border: '1.5px solid var(--pink-mid)',
              borderRadius: 16, padding: '14px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, color: 'var(--pink-label)', marginBottom: 12, fontWeight: 600 }}>
                Switch your viewpoint to see what another business owner sees.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={selectedBizId}
                  onChange={e => setSelectedBizId(e.target.value)}
                  className="sm-input"
                  style={{
                    flex: 1, padding: '10px', borderRadius: 12, background: 'var(--plum-mid)',
                    border: '1px solid var(--pink-mid)', color: 'white', fontSize: 13,
                  }}
                >
                  <option value="">Select a business...</option>
                  {allBusinesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.owner_name || 'No Owner Name'})</option>
                  ))}
                </select>
                <button
                  onClick={handleSwitch}
                  disabled={!selectedBizId}
                  style={{
                    padding: '0 16px', borderRadius: 12, background: 'var(--pink)',
                    color: 'white', border: 'none', fontWeight: 700, fontSize: 12,
                    cursor: selectedBizId ? 'pointer' : 'default', opacity: selectedBizId ? 1 : 0.5
                  }}
                >
                  Switch
                </button>
              </div>
            </div>

            <SectionLabel>Super Admin: Provisioning</SectionLabel>
            <div style={{ background: 'var(--plum-dark)', border: '1.5px solid var(--pink-mid)', borderRadius: 16, padding: '14px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--pink-label)', marginBottom: 12, fontWeight: 600 }}>Create a new business and owner account.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input placeholder="Business Name" value={provForm.biz} onChange={e => setProvForm(p => ({...p, biz: e.target.value}))} className="sm-input" style={{ padding: '10px', borderRadius: 12, background: 'var(--plum-mid)', border: '1px solid var(--pink-mid)', color: 'white', fontSize: 13 }} />
                <input placeholder="Owner Full Name" value={provForm.owner} onChange={e => setProvForm(p => ({...p, owner: e.target.value}))} className="sm-input" style={{ padding: '10px', borderRadius: 12, background: 'var(--plum-mid)', border: '1px solid var(--pink-mid)', color: 'white', fontSize: 13 }} />
                <input placeholder="Owner Email" value={provForm.email} onChange={e => setProvForm(p => ({...p, email: e.target.value}))} className="sm-input" style={{ padding: '10px', borderRadius: 12, background: 'var(--plum-mid)', border: '1px solid var(--pink-mid)', color: 'white', fontSize: 13 }} />
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? "text" : "password"} placeholder="Temp Password" value={provForm.pw} onChange={e => setProvForm(p => ({...p, pw: e.target.value}))} className="sm-input" style={{ width: '100%', padding: '10px', paddingRight: 36, borderRadius: 12, background: 'var(--plum-mid)', border: '1px solid var(--pink-mid)', color: 'white', fontSize: 13 }} />
                  <ToggleBtn show={showPw} onToggle={() => setShowPw(!showPw)} color="var(--pink-label)" />
                </div>
                <button onClick={handleProvision} disabled={isProv || !provForm.biz || !provForm.email} style={{ padding: '12px', borderRadius: 12, background: 'var(--pink)', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: isProv ? 'default' : 'pointer', opacity: (isProv || !provForm.biz || !provForm.email) ? 0.5 : 1 }}>
                  {isProv ? 'Provisioning…' : 'Create Business & Owner'}
                </button>
                {provMsg && <div style={{ color: 'var(--pink-label)', fontSize: 11, padding: '4px 8px', textAlign: 'center' }}>{provMsg}</div>}
              </div>
            </div>

            <SectionLabel>Super Admin: Data Management</SectionLabel>
            <div style={{ background: 'var(--plum-dark)', border: '1.5px solid var(--pink-mid)', borderRadius: 16, padding: '14px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--pink-label)', marginBottom: 12, fontWeight: 600 }}>Soft-delete businesses (immediately hides them from UI).</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(allBusinesses || []).filter(b => !b.deleted_at).map(b => (
                  <div key={b.id}>
                    {deleteConfirm?.id === b.id ? (
                      <div style={{ background: 'rgba(176,21,80,0.12)', border: '1px solid rgba(176,21,80,0.4)', borderRadius: 12, padding: '10px 12px' }}>
                        <div style={{ color: 'white', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Remove "{b.name}"?</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" onClick={() => setDeleteConfirm(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 0', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                          <button type="button" onClick={() => handleSoftDeleteBiz(b.id)} style={{ flex: 1, background: 'var(--pink-mid)', border: 'none', borderRadius: 8, padding: '7px 0', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Yes, remove</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: 'white', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                          <div style={{ color: 'var(--pink-label)', fontSize: 10 }}>{b.owner_name || 'No Owner'}</div>
                        </div>
                        <button type="button" onClick={() => setDeleteConfirm({ id: b.id, name: b.name })} style={{ background: 'transparent', border: '1px solid var(--pink)', color: 'var(--pink)', padding: '5px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {(allBusinesses || []).some(b => b.deleted_at) && (
              <div style={{ background: 'var(--plum-dark)', border: '1.5px solid var(--pink-mid)', borderRadius: 16, padding: '14px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--pink-label)', marginBottom: 12, fontWeight: 600 }}>Deleted businesses — restore to make them active again.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(allBusinesses || []).filter(b => b.deleted_at).map(b => (
                    <div key={b.id}>
                      {restoreConfirm?.id === b.id ? (
                        <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.4)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ color: 'white', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Restore "{b.name}"?</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" onClick={() => setRestoreConfirm(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 0', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                            <button type="button" onClick={() => handleRestoreBiz(b.id)} style={{ flex: 1, background: 'var(--green)', border: 'none', borderRadius: 8, padding: '7px 0', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Yes, restore</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', opacity: 0.8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{b.owner_name || 'No Owner'} · deleted {new Date(b.deleted_at).toLocaleDateString()}</div>
                          </div>
                          <button type="button" onClick={() => setRestoreConfirm({ id: b.id, name: b.name })} style={{ background: 'transparent', border: '1px solid var(--green)', color: 'var(--green)', padding: '5px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Restore</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <SectionLabel>Overview</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <StatCard T={T} label="Total Clients" value={clientsLoading ? '…' : (clients || []).length} />
          <StatCard T={T} label="Revenue YTD" value={jobsLoading ? '…' : `$${revenueYtd.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} />
        </div>

        <SectionLabel>AI Persona & Style</SectionLabel>
        <div style={{
          background: T.card, border: `1.5px solid ${T.cardBorder}`,
          borderRadius: 16, padding: '14px', marginBottom: 20,
        }}>
          {!business && isSuperAdmin ? (
            <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, textAlign: 'center', padding: '10px 0' }}>
              Select a business viewpoint above to configure AI assistant preferences.
            </div>
          ) : !business ? (
             <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, textAlign: 'center', padding: '10px 0' }}>
              Loading AI preferences...
            </div>
          ) : (
            <>
              <div style={{ fontFamily: T.font, fontSize: 11, color: T.inkMuted, marginBottom: 12, lineHeight: 1.4 }}>
                Choose how your AI assistant speaks to you in briefings. It learns your preferences over time.
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { id: 'professional', label: 'Professional', desc: 'Clear, concise, and business-focused.' },
                  { id: 'coach', label: 'Encouraging Coach', desc: 'Warm, supportive, and motivating.' },
                  { id: 'casual', label: 'Casual Pal', desc: 'Relaxed, friendly, and low-key.' },
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleStyleChange(s.id)}
                    aria-pressed={aiStyle === s.id}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 12,
                      cursor: isSaving ? 'default' : 'pointer',
                      background: aiStyle === s.id ? T.pinkTint : 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${aiStyle === s.id ? T.pink : T.cardBorder}`,
                      transition: 'all 0.2s',
                      opacity: isSaving && aiStyle !== s.id ? 0.5 : 1
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: aiStyle === s.id ? T.pink : T.ink }}>
                        {s.label}
                        {isSaving && aiStyle === s.id && ' (Saving...)'}
                      </span>
                      {aiStyle === s.id && !isSaving && <span style={{ color: T.pink, fontSize: 12 }}>✓</span>}
                    </div>
                    <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 2 }}>{s.desc}</div>
                  </button>
                ))}

                <div style={{ marginTop: 16 }}>
                  <button 
                    onClick={handleTestPersona}
                    disabled={isTesting}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 12,
                      background: 'transparent', border: `1px solid ${T.pink}`, color: T.pink,
                      fontSize: 12, fontWeight: 700, cursor: isTesting ? 'default' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isTesting ? 'Testing Persona…' : 'Test Selected Persona'}
                  </button>
                  {testResult && (
                    <div style={{
                      marginTop: 12, padding: '12px', borderRadius: 12,
                      background: T.pinkTint,
                      border: `1.5px solid ${T.cardBorder}`,
                      fontStyle: 'italic', fontSize: 13, color: T.ink,
                      lineHeight: 1.4
                    }}>
                      "{testResult}"
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <SectionLabel>Tools</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <ToolRow T={T} icon="⚙" label="Business Settings" sub="Profile, rates, Google Calendar" onClick={() => navigate('/settings')} />
          <ToolRow T={T} icon="👥" label="Staff Management" sub="Workers, staff, skills &amp; pay rates" onClick={() => setShowWorkers(true)} />
          <ToolRow T={T} icon="🗂" label="Service Catalog" sub="Manage defaults, rates, durations" onClick={() => setShowServices(true)} />
        </div>

        <SectionLabel>Security</SectionLabel>
        <div style={{
          background: T.card, border: `1.5px solid ${T.cardBorder}`,
          borderRadius: 16, padding: '14px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Change Password</span>
            {pwSaved && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: 8 }}>UPDATED ✓</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label htmlFor="admin-pw" style={{ fontSize: 10, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="admin-pw"
                  type={showPw ? "text" : "password"}
                  value={pwForm.pw}
                  onChange={e => setPwForm(p => ({ ...p, pw: e.target.value }))}
                  placeholder="Min 8 chars"
                  className="sm-input"
                  style={{
                    width: '100%', padding: '10px 12px', paddingRight: 36, borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`,
                    color: T.ink, fontSize: 13,
                  }}
                />
                <ToggleBtn show={showPw} onToggle={() => setShowPw(!showPw)} />
              </div>
            </div>

            <div>
              <label htmlFor="admin-pw2" style={{ fontSize: 10, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Confirm password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="admin-pw2"
                  type={showPw2 ? "text" : "password"}
                  value={pwForm.pw2}
                  onChange={e => setPwForm(p => ({ ...p, pw2: e.target.value }))}
                  className="sm-input"
                  style={{
                    width: '100%', padding: '10px 12px', paddingRight: 36, borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`,
                    color: T.ink, fontSize: 13,
                  }}
                />
                <ToggleBtn show={showPw2} onToggle={() => setShowPw2(!showPw2)} />
              </div>
            </div>

            {pwError && (
              <div role="alert" style={{ fontSize: 11, color: '#B91C1C', background: 'rgba(239,68,68,0.08)', padding: '8px', borderRadius: 8 }}>
                {pwError}
              </div>
            )}

            <button
              onClick={handleUpdatePassword}
              disabled={savingPw}
              style={{
                marginTop: 4, width: '100%', padding: '12px',
                background: savingPw ? T.pinkTint : T.pink,
                color: 'white', border: 'none', borderRadius: 12,
                fontSize: 13, fontWeight: 700, cursor: savingPw ? 'default' : 'pointer',
              }}
            >
              {savingPw ? 'Updating…' : 'Save New Password'}
            </button>
          </div>
        </div>

        <div style={{ paddingTop: 8, paddingBottom: 24 }}>
          <button
            onClick={signOut}
            style={{ 
              width: '100%', padding: '12px', 
              background: 'transparent', border: `1px solid ${T.cardBorder}`, 
              borderRadius: 12, color: T.inkMuted, 
              fontSize: 12, fontWeight: 600, cursor: 'pointer' 
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <ServiceCatalogSheet
        isOpen={showServices}
        onClose={() => setShowServices(false)}
      />
      <WorkerCatalogSheet
        isOpen={showWorkers}
        onClose={() => setShowWorkers(false)}
      />
    </div>
  );
}

function StatCard({ T, label, value }) {
  return (
    <div style={{
      background: T.card, border: `1.5px solid ${T.cardBorder}`,
      borderRadius: 13, padding: 12, textAlign: 'center'
    }}>
      <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: T.serif, fontSize: 18, color: T.pink, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function ToolRow({ T, icon, label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        background: T.card, border: `1.5px solid ${T.cardBorder}`,
        borderRadius: 13, padding: 12, display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.ink }}>{label}</div>
        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted }}>{sub}</div>
      </div>
      <div style={{ color: T.inkMuted, fontSize: 14 }}>›</div>
    </button>
  );
}
