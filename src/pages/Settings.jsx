import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const [integration, setIntegration] = useState(null);

  useEffect(() => {
    async function checkIntegration() {
      if (!user) return;
      const { data } = await supabase
        .from('integrations')
        .select('*')
        .eq('service_name', 'google_calendar')
        .maybeSingle();
      setIntegration(data);
    }
    checkIntegration();
  }, [user]);

  const connectGoogle = () => {
    window.location.href = '/api/auth/google/login';
  };

  const syncSuccess = searchParams.get('sync') === 'success';
  const error = searchParams.get('error');

  return (
    <div className="page" style={{ background: 'var(--pink-pale)', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="hero-section">
        <div className="hero-label">Preferences</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: 0, color: 'white' }}>Settings</h2>
      </div>
      <div className="content" style={{ padding: '16px 14px', flex: 1 }}>
        
        <div className="card" style={{ background: 'white', borderRadius: 'var(--r-card)', border: 'var(--border-card)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Google Calendar Sync</span>
            {integration ? (
              <span className="badge" style={{ background: 'var(--green-light)', color: 'var(--green-text)' }}>CONNECTED ✓</span>
            ) : (
              <span className="badge" style={{ background: 'var(--pink-tint)', color: 'var(--pink-mid)' }}>NOT CONNECTED</span>
            )}
          </div>
          
          <p style={{ fontSize: 12, color: 'var(--ink-mid)', marginBottom: 16 }}>
            {integration 
              ? "Your jobs are automatically synced to your Google Calendar." 
              : "Connect your Google account to sync your schedule to your personal calendar."}
          </p>

          <button 
            onClick={connectGoogle} 
            className="go-btn"
            style={{ 
              background: integration ? 'var(--pink-tint)' : 'var(--pink)', 
              color: integration ? 'var(--pink-mid)' : 'white',
              border: 'none',
              padding: '12px',
              borderRadius: 'var(--r-input)',
              fontSize: 13,
              fontWeight: 700,
              width: '100%',
              cursor: 'pointer'
            }}
          >
            {integration ? "Reconnect Google Calendar" : "Connect Google Calendar"}
          </button>
        </div>

        {syncSuccess && (
          <div style={{ marginTop: 12, padding: 10, background: 'var(--green-light)', borderRadius: 8, fontSize: 12, color: 'var(--green-text)', textAlign: 'center' }}>
            Successfully connected to Google Calendar!
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: 10, background: '#FEE2E2', borderRadius: 8, fontSize: 12, color: '#991B1B', textAlign: 'center' }}>
            Error: {error}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 40 }}>
          <button 
            onClick={signOut} 
            style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--pink-border)', borderRadius: 'var(--r-input)', color: 'var(--ink-muted)', fontSize: 12, fontWeight: 600 }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
