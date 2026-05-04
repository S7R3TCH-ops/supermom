import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { supabase } from '../../lib/supabase';
import { notifyDataChanged, useBusiness } from '../../data/useData';
import { useToast } from '../../context/ToastContext';
import { getCurrentBusinessId } from '../../data/currentBusiness';
import { SectionLabel } from '../ui/typography';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function ServiceCatalogSheet({ isOpen, onClose }) {
  const { T, mode } = useAppTheme();
  const { business } = useBusiness();
  const toast = useToast();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, isOpen, onClose);

  const [formServices, setFormServices] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const bid = await getCurrentBusinessId();
      if (!bid) return;

      const { data, error: err } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', bid)
        .order('sort_order', { ascending: true });
      if (err) throw err;

      setFormServices((data || []).map(s => ({
        ...s,
        default_price: String(s.default_price || 0),
        default_duration: String(s.default_duration || 120),
        isNew: false
      })));
      setDeletedIds([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  const handleUpdate = (tempId, field, val) => {
    setFormServices(prev => prev.map(s => (s.id === tempId || s.tempId === tempId) ? { ...s, [field]: val } : s));
  };

  const handleAdd = () => {
    const newSvc = {
      tempId: Math.random().toString(36).substr(2, 9),
      name: '',
      pricing_type: 'Hourly',
      default_price: '60',
      default_duration: '120',
      active: true,
      isNew: true
    };
    setFormServices(prev => [...prev, newSvc]);
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const bid = await getCurrentBusinessId();
      if (!bid) throw new Error('No business ID found');

      // 1. Process Soft Deletions (active = false)
      if (deletedIds.length > 0) {
        const { error: delErr } = await supabase
          .from('services')
          .update({ active: false })
          .in('id', deletedIds)
          .eq('business_id', bid);
        if (delErr) throw delErr;
      }

      // 2. Prepare items for Upsert
      const upserts = formServices
        .filter(s => s.name.trim()) // Ignore empty names
        .map((s, idx) => {
          const item = {
            business_id: bid,
            name: s.name,
            pricing_type: s.pricing_type,
            default_price: parseFloat(s.default_price) || 0,
            default_duration: parseFloat(s.default_duration) || 120,
            active: s.active,
            sort_order: idx
          };
          // Only include ID if it's an existing record
          if (s.id && !s.isNew) item.id = s.id;
          return item;
        });

      if (upserts.length > 0) {
        const { data: upserted, error: upsertErr } = await supabase
          .from('services')
          .upsert(upserts, { onConflict: 'id' })
          .select();
        if (upsertErr) throw upsertErr;
        if (!upserted?.length) {
          console.error('[ServiceCatalog] Upsert returned 0 rows — likely an RLS policy blocking writes for this user.');
          throw new Error('Save was blocked — no rows were written. Check RLS policies in Supabase.');
        }
      }

      setDeletedIds([]);
      notifyDataChanged();
      toast.success('Service catalog updated.');
      onClose();
    } catch (e) {
      console.error('[ServiceCatalog] Save error:', e);
      const msg = e.message || String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(4,1,12,0.6)',
      animation: 'scFade 200ms ease-out',
    }}>
      <style>{`
        @keyframes scFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div onClick={onClose} style={{ flex: 1 }} />

      <div ref={sheetRef} onClick={e => e.stopPropagation()} style={{
        background: T.bg, color: T.ink,
        borderRadius: '24px 24px 0 0',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        animation: 'scSlide 300ms cubic-bezier(0.2,0.8,0.2,1)',
        border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
      }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, color: T.pink, textTransform: 'uppercase', letterSpacing: '1px' }}>ADMIN TOOLS</div>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>Service Catalog</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: T.inkMuted, cursor: 'pointer' }}>×</button>
        </div>

        {/* Scrollable Body */}
        <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 30px' }}>
          <div style={{ marginBottom: 16, fontSize: 12, color: T.inkMuted, lineHeight: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, paddingRight: 20 }}>
              Manage your standard service offerings. These defaults are used when booking new jobs.
            </div>
            <button 
              onClick={handleAdd}
              style={{ 
                background: T.pink, color: 'white', border: 'none', borderRadius: 8, 
                padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' 
              }}
            >
              + Add Service
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>Loading services...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {formServices.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', border: `2px dashed ${T.cardBorder}`, borderRadius: 16, color: T.inkMuted }}>
                  No services found. Click "+ Add Service" to start your catalog.
                </div>
              )}
              {formServices.map(s => (
                <div key={s.id || s.tempId} style={{ 
                  background: T.card, border: `1.5px solid ${T.cardBorder}`, 
                  borderRadius: 16, padding: '14px', position: 'relative',
                  boxShadow: mode === 'dark' ? 'none' : '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete service "${s.name || 'this service'}"?`)) {
                        setFormServices(prev => prev.filter(item => (s.id ? item.id !== s.id : item.tempId !== s.tempId)));
                        if (s.id) setDeletedIds(prev => [...prev, s.id]);
                      }
                    }}
                    style={{
                      position: 'absolute', top: 10, right: 10,
                      width: 24, height: 24, borderRadius: 6,
                      background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#FFF0F7',
                      border: 'none', color: T.pink, fontSize: 16, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 2
                    }}
                  >
                    ×
                  </button>

                  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Service Name</label>
                      <input 
                        placeholder="e.g. Decluttering"
                        value={s.name} 
                        onChange={e => handleUpdate(s.id || s.tempId, 'name', e.target.value)}
                        style={{ 
                          width: '100%', 
                          background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#FAF3F6', 
                          border: 'none', 
                          borderBottom: `2px solid ${T.pink}40`, 
                          padding: '8px 10px', 
                          borderRadius: '8px 8px 0 0',
                          color: T.ink, 
                          fontFamily: T.serif, 
                          fontSize: 16, 
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ width: 100 }}>
                      <label style={{ fontSize: 9, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Pricing</label>
                      <select 
                        value={s.pricing_type} 
                        onChange={e => handleUpdate(s.id || s.tempId, 'pricing_type', e.target.value)}
                        style={{ 
                          width: '100%', 
                          background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#FAF3F6', 
                          border: 'none', 
                          borderBottom: `2px solid ${T.pink}40`, 
                          padding: '8px 8px', 
                          borderRadius: '8px 8px 0 0',
                          color: T.ink, 
                          fontSize: 13, 
                          outline: 'none',
                          height: 37,
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="Hourly">Hourly</option>
                        <option value="Flat">Flat Rate</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 9, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Default {s.pricing_type === 'Hourly' ? 'Rate ($/hr)' : 'Price ($)'}
                      </label>
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#FAF3F6',
                        padding: '0 10px', borderRadius: '8px 8px 0 0',
                        borderBottom: `2px solid ${T.pink}40`,
                      }}>
                        <span style={{ color: T.inkMuted, fontSize: 14 }}>$</span>
                        <input 
                          type="number"
                          value={s.default_price} 
                          onChange={e => handleUpdate(s.id || s.tempId, 'default_price', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 0', color: T.ink, fontSize: 15, outline: 'none' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 9, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Default Duration (mins)</label>
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#FAF3F6',
                        padding: '0 10px', borderRadius: '8px 8px 0 0',
                        borderBottom: `2px solid ${T.pink}40`,
                      }}>
                        <input 
                          type="number"
                          value={s.default_duration} 
                          onChange={e => handleUpdate(s.id || s.tempId, 'default_duration', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 0', color: T.ink, fontSize: 15, outline: 'none' }}
                        />
                        <span style={{ color: T.inkMuted, fontSize: 10, fontWeight: 700 }}>MINS</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input 
                      type="checkbox" 
                      checked={s.active} 
                      onChange={e => handleUpdate(s.id || s.tempId, 'active', e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, color: T.inkSub, fontWeight: 600 }}>Active in catalog</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, padding: '10px', borderRadius: 10, background: T.redBg, color: T.red, fontSize: 12, border: `1px solid ${T.redBorder}` }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px 24px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: 'transparent', color: T.inkSub, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={busy || loading} style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: (busy || loading) ? T.pinkTint : T.pink, color: 'white', fontSize: 13, fontWeight: 700, cursor: (busy || loading) ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}>
            {busy ? 'Saving...' : 'Save Catalog Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
