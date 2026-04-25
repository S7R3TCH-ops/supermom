import { useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import { useAuth } from '../context/AuthContext';
import { useBusiness, useClients, useJobs } from '../data/useData';
import SectionLabel from '../components/ui/SectionLabel';

export default function Admin() {
  const { T, mode } = useAppTheme();
  const { profile } = useAuth();
  const { business, loading: bizLoading, update: updateBiz } = useBusiness();
  const { clients, loading: clientsLoading } = useClients();
  const { jobs, loading: jobsLoading } = useJobs();

  const [isSaving, setIsSaving] = useState(false);

  const handleStyleChange = async (style) => {
    setIsSaving(true);
    try {
      const newProfile = { ...(business.ai_profile || {}), style };
      await updateBiz({ ai_profile: newProfile });
    } catch (err) {
      console.error('Failed to update AI style:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const revenueYtd = jobs
    .filter(j => j.raw.job_status === 'Completed')
    .reduce((sum, j) => sum + Number(j.raw.total_amount || 0), 0);

  const aiStyle = business?.ai_profile?.style || 'professional';

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
          {profile?.business_name || 'Business Dashboard'}
        </h2>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
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
        </div>

        <SectionLabel>Tools</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ToolRow T={T} icon="📊" label="Detailed Reports" sub="Coming soon" />
          <ToolRow T={T} icon="👥" label="Staff Management" sub="Coming soon" />
          <ToolRow T={T} icon="⚙" label="Service Catalog" sub="Coming soon" />
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

function ToolRow({ T, icon, label, sub }) {
  return (
    <div style={{
      background: T.card, border: `1.5px solid ${T.cardBorder}`,
      borderRadius: 13, padding: 12, display: 'flex', alignItems: 'center', gap: 12
    }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.ink }}>{label}</div>
        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted }}>{sub}</div>
      </div>
    </div>
  );
}
