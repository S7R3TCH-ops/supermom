import { useState, useEffect, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { fetchDeepPrepNote } from '../../data/ai';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function PrepNoteSheet({ isOpen, onClose, clientId, businessProfile }) {
  const { T, mode } = useAppTheme();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, isOpen, onClose);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && clientId) {
      const getNote = async () => {
        setLoading(true);
        setError(null);
        try {
          const note = await fetchDeepPrepNote(clientId, businessProfile);
          setSummary(note);
        } catch (err) {
          setError(err.message || 'Could not generate prep note.');
        } finally {
          setLoading(false);
        }
      };
      getNote();
    }
  }, [isOpen, clientId, businessProfile]);

  if (!isOpen) return null;

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Prep note"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.5)',
        animation: 'prepFade 180ms ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes prepFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes prepSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div 
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--pink-pale)',
          color: '#1A0A12',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
          maxHeight: '85svh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'prepSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
          border: '1px solid var(--pink-border)',
          borderBottom: 'none',
          overflow: 'hidden'
        }}
      >
        {/* Header Section */}
        <div style={{ background: T.hero, padding: '12px 20px 20px', position: 'relative' }}>
          <div style={{ 
            width: 40, height: 4, background: '#FFD6E8', borderRadius: 4, 
            margin: '0 auto 16px', opacity: 0.3 
          }} />
          
          <div style={{ 
            fontFamily: T.font, fontSize: 10, fontWeight: 700, 
            letterSpacing: '1.2px', textTransform: 'uppercase', 
            color: '#FF78B0', marginBottom: 4 
          }}>
            ✦ AI Prep Note
          </div>
          
          <div style={{ 
            fontFamily: T.serif, fontSize: 22, fontWeight: 500, 
            color: 'white', letterSpacing: '-0.3px'
          }}>
            Client Briefing
          </div>
        </div>

        {/* Content Area */}
        <div className="sm-scroll" style={{ 
          padding: '24px 20px 32px', 
          overflowY: 'auto',
          flex: 1
        }}>
          {loading ? (
            <div style={{ 
              padding: '40px 0', textAlign: 'center', 
              color: '#5A3040', fontFamily: T.font, fontSize: 15 
            }}>
              <div className="sm-pulse" style={{ marginBottom: 12, fontSize: 24 }}>✦</div>
              <div className="sm-pulse">Generating your briefing...</div>
            </div>
          ) : error ? (
            <div style={{ 
              padding: '20px', background: 'rgba(176,21,80,0.05)', 
              borderRadius: 16, border: '1px solid rgba(176,21,80,0.1)',
              color: '#B01550', fontFamily: T.font, fontSize: 14, lineHeight: 1.5 
            }}>
              <strong>Oops!</strong> {error}
            </div>
          ) : (
            <div style={{ 
              fontFamily: T.font, fontSize: 16, lineHeight: 1.65, 
              color: '#1A0A12', whiteSpace: 'pre-wrap' 
            }}>
              {summary || 'No briefing available for this client yet.'}
            </div>
          )}

          <button
            onClick={onClose}
            style={{ 
              marginTop: 32, width: '100%', padding: '14px 0', 
              borderRadius: 14, border: 'none', 
              background: 'var(--grad-pink)', 
              color: 'white', fontFamily: T.font, fontSize: 15, 
              fontWeight: 700, boxShadow: '0 4px 12px rgba(233,30,106,0.2)'
            }}
          >
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
}
