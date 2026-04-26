import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../context/AppThemeContext';
import { useAuth } from '../context/AuthContext';
import { useBusiness, useClients, useJobs } from '../data/useData';
import SectionLabel from '../components/ui/SectionLabel';
import { useViewpoint } from '../context/ViewpointContext';

export default function Admin() {
  const { T, mode } = useAppTheme();
  const { profile, signOut } = useAuth();
  const { business, loading: bizLoading, update: updateBiz } = useBusiness();
  const { clients, loading: clientsLoading } = useClients();
  const { jobs, loading: jobsLoading } = useJobs();
  const { isSuperAdmin, allBusinesses, switchTo, viewingAsId, reset } = useViewpoint();
  const navigate = useNavigate();

  const [isSaving, setIsSaving] = useState(false);
  const [selectedBizId, setSelectedBizId] = useState('');

  const handleStyleChange = async (style) => {
    if (!business) return;
    setIsSaving(true);
    try {
      const newProfile = { ...(business?.ai_profile || {}), style };
      await updateBiz({ ai_profile: newProfile });
    } catch (err) {
      console.error('Failed to update AI style:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitch = () => {
    const biz = allBusinesses.find(b => b.id === selectedBizId);
    if (biz) switchTo(biz.id, biz.owner_name || biz.name);
  };

  const revenueYtd = jobs
    .filter(j => j.raw.job_status === 'Completed')
    .reduce((sum, j) => sum + Number(j.raw.total_amount || 0), 0);

  const aiStyle = business?.ai_profile?.style || 'professional';

  const [pwForm, setPwForm] = useState({ pw: '', pw2: '' });
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState(null);

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
      setPwSaved(true);
      setPwForm({ pw: '', pw2: '' });
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err) {
      setPwError(err.message || 'Failed to update password.');
    } finally {
      setSavingPw(false);
    }
  };

  const ToggleBtn = ({ show, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 4, color: T.inkMuted,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      <div style={{
        background: T.hero, borderBottom: '3px solid #E91E6A',
        padding: '12px 14px 16px', position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 180, height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(233,30,106,0.22) 0%,transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px',
          textTransform: 'uppercase', color: '#FF78B0', marginBottom: 10,
        }}>✦ Business Admin</div>
        
        <h2 style={{ fontFamily: T.serif, fontSize: 24, margin: 0, color: 'white' }}>
          {business?.name || profile?.business_name || 'Business Dashboard'}
        </h2>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        {isSuperAdmin && (
          <>
            <SectionLabel>Super Admin: Viewpoint</SectionLabel>
            <div style={{
              background: '#1a0a0a', border: '1.5px solid #7f1d1d',
              borderRadius: 16, padding: '14px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, color: '#fca5a5', marginBottom: 12, fontWeight: 600 }}>
                Switch your viewpoint to see what another business owner sees.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select 
                  value={selectedBizId} 
                  onChange={e => setSelectedBizId(e.target.value)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 12, background: '#2d0f0f',
                    border: '1px solid #7f1d1d', color: 'white', fontSize: 13, outline: 'none'
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
                    padding: '0 16px', borderRadius: 12, background: '#ef4444',
                    color: 'white', border: 'none', fontWeight: 700, fontSize: 12,
                    cursor: selectedBizId ? 'pointer' : 'default', opacity: selectedBizId ? 1 : 0.5
                  }}
                >
                  Switch
                </button>
              </div>
              {viewingAsId && (
                <button 
                  onClick={reset}
                  style={{
                    marginTop: 10, width: '100%', padding: '10px', borderRadius: 12,
                    background: 'transparent', border: '1px solid #7f1d1d',
                    color: '#f87171', fontWeight: 600, fontSize: 12, cursor: 'pointer'
                  }}
                >
                  Reset to My Real View
                </button>
              )}
            </div>
          </>
        )}

        <SectionLabel>Overview</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <StatCard T={T} label="Total Clients" value={clientsLoading ? '...' : clients.length} />
          <StatCard T={T} label="Revenue YTD" value={jobsLoading ? '...' : `$${revenueYtd.toFixed(0)}`} />
        </div>

        <SectionLabel>AI Persona & Style</SectionLabel>
        <div style={{
          background: T.card, border: `1.5px solid ${T.cardBorder}`,
          borderRadius: 16, padding: '14px', marginBottom: 20,
        }}>
          {!business ? (
            <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, textAlign: 'center', padding: '10px 0' }}>
              Select a business viewpoint above to configure AI preferences.
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
                  <div 
                    key={s.id}
                    onClick={() => !isSaving && handleStyleChange(s.id)}
                    style={{
                      padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                      background: aiStyle === s.id ? T.pinkTint : 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${aiStyle === s.id ? T.pink : T.cardBorder}`,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: aiStyle === s.id ? T.pink : T.ink }}>{s.label}</span>
                      {aiStyle === s.id && <span style={{ color: T.pink, fontSize: 12 }}>✓</span>}
                    </div>
                    <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 2 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <SectionLabel>Tools</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <ToolRow T={T} icon="⚙" label="Business Settings" sub="Profile, rates, Google Calendar" onClick={() => navigate('/settings')} />
          <ToolRow T={T} icon="📊" label="Detailed Reports" sub="Coming soon" />
          <ToolRow T={T} icon="👥" label="Staff Management" sub="Coming soon" />
          <ToolRow T={T} icon="🗂" label="Service Catalog" sub="Coming soon" />
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
              <label htmlFor="admin-pw" style={{ fontSize: 10, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="admin-pw"
                  type={showPw ? "text" : "password"}
                  value={pwForm.pw}
                  onChange={e => setPwForm(p => ({ ...p, pw: e.target.value }))}
                  placeholder="Min 8 chars"
                  style={{
                    width: '100%', padding: '10px 12px', paddingRight: 36, borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`,
                    color: T.ink, fontSize: 13, outline: 'none'
                  }}
                />
                <ToggleBtn show={showPw} onToggle={() => setShowPw(!showPw)} />
              </div>
            </div>

            <div>
              <label htmlFor="admin-pw2" style={{ fontSize: 10, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Confirm</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="admin-pw2"
                  type={showPw2 ? "text" : "password"}
                  value={pwForm.pw2}
                  onChange={e => setPwForm(p => ({ ...p, pw2: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 12px', paddingRight: 36, borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`,
                    color: T.ink, fontSize: 13, outline: 'none'
                  }}
                />
                <ToggleBtn show={showPw2} onToggle={() => setShowPw2(!showPw2)} />
              </div>
            </div>

            {pwError && (
              <div style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '8px', borderRadius: 8 }}>
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
    <div
      onClick={onClick}
      style={{
        background: T.card, border: `1.5px solid ${T.cardBorder}`,
        borderRadius: 13, padding: 12, display: 'flex', alignItems: 'center', gap: 12,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.ink }}>{label}</div>
        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted }}>{sub}</div>
      </div>
      {onClick && <div style={{ color: T.inkMuted, fontSize: 14 }}>›</div>}
    </div>
  );
}
