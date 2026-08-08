import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { supabase } from '../../lib/supabase';
import { notifyDataChanged, useBusiness } from '../../data/useData';
import { useToast } from '../../context/ToastContext';
import { getCurrentBusinessId } from '../../data/currentBusiness';
import { SectionLabel } from '../ui/typography';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { NoServices } from '../ui/Illustrations';
import GrabBar from '../ui/GrabBar';

export default function ServiceCatalogSheet({ isOpen, onClose }) {
  const { T, mode } = useAppTheme();
  const { business } = useBusiness();
  const toast = useToast();
  const sheetRef = useRef(null);

  const [formServices, setFormServices] = useState([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isDirty = useMemo(() => {
    if (!snapshot) return false;
    const current = JSON.stringify({ 
      services: formServices, 
      deleted: pendingDeleteIds 
    });
    return current !== snapshot;
  }, [formServices, pendingDeleteIds, snapshot]);

  const attemptClose = useCallback(() => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Discard them?")) {
        return;
      }
    }
    onClose();
  }, [isDirty, onClose]);

  useFocusTrap(sheetRef, isOpen, attemptClose);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const bid = await getCurrentBusinessId();
      if (!bid) return;

      const { data, error: err } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', bid)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (err) throw err;

      const mapped = (data || []).map(s => ({
        ...s,
        // If default_price is null or exactly 0 (sentinel), we use business default
        use_business_default: s.default_price === null || s.default_price === 0,
        default_price: s.default_price !== null ? String(s.default_price) : String(business?.hourly_rate || 60),
        default_duration: String((s.default_duration || 120) / 60),
        isNew: false
      }));

      setFormServices(mapped);
      setPendingDeleteIds([]);
      setSnapshot(JSON.stringify({ services: mapped, deleted: [] }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [business?.hourly_rate]);

  useEffect(() => {
    if (isOpen) {
      Promise.resolve().then(() => refresh());
    }
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  const handleUpdate = (id, field, val) => {
    setFormServices(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updates = { [field]: val };
      if (field === 'pricing_type') updates.default_price = '';
      return { ...s, ...updates };
    }));
  };

  const handleToggleDelete = (id) => {
    const svc = formServices.find(s => s.id === id);
    if (svc?.isNew) {
      // For new services, remove immediately
      setFormServices(prev => prev.filter(s => s.id !== id));
      return;
    }
    setPendingDeleteIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAdd = () => {
    const newSvc = {
      id: crypto.randomUUID(),
      name: '',
      pricing_type: 'Flat',
      use_business_default: false,
      default_price: '',
      default_duration: '2',
      active: true,
      isNew: true
    };
    setFormServices(prev => [newSvc, ...prev]);
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const bid = await getCurrentBusinessId();
      if (!bid) throw new Error('No business ID found');

      // 1. Process Soft Deletions (active = false)
      // Merge pendingDeleteIds with services manually unchecked as inactive
      const deletedIds = formServices.filter(s => s.id && !s.active).map(s => s.id);
      const allDeactivateIds = [...new Set([...pendingDeleteIds, ...deletedIds])];

      if (allDeactivateIds.length > 0) {
        const { data: deleted, error: delErr } = await supabase
          .from('services')
          .update({ active: false })
          .in('id', allDeactivateIds)
          .eq('business_id', bid)
          .select();
        if (delErr) throw delErr;
        if (!deleted?.length) {
          throw new Error('Delete was blocked — RLS policy may not allow this user to modify these services.');
        }
      }

      // 2. Prepare items for Upsert
      const upserts = formServices
        .filter(s => s.name.trim() && !pendingDeleteIds.includes(s.id)) // Ignore empty names & pending deletes
        .map((s, idx) => {
          const isHourly = s.pricing_type === 'Hourly';
          const item = {
            id: s.id,
            business_id: bid,
            name: s.name,
            pricing_type: s.pricing_type,
            // If using business default, we store NULL in the DB
            default_price: (isHourly && s.use_business_default) ? null : (parseFloat(s.default_price) || 0),
            default_duration: (parseFloat(s.default_duration) || 2) * 60,
            active: s.active,
            sort_order: idx
          };
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

      setPendingDeleteIds([]);
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

      <div onClick={attemptClose} style={{ flex: 1 }} />

      <div ref={sheetRef} onClick={e => e.stopPropagation()} style={{
        background: T.bg, color: T.ink,
        borderRadius: '24px 24px 0 0',
        maxHeight: 'calc(var(--app-height, 100dvh) * 0.94)', display: 'flex', flexDirection: 'column',
        animation: 'scSlide 300ms cubic-bezier(0.2,0.8,0.2,1)',
        border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
      }}>
        <GrabBar onDismiss={onClose} />
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <SectionLabel serif={false} style={{ marginBottom: 4 }}>ADMIN TOOLS</SectionLabel>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>Service Catalog</div>
          </div>
          <button onClick={attemptClose} style={{ background: 'none', border: 'none', fontSize: 20, color: T.inkMuted, cursor: 'pointer' }}>×</button>
        </div>

        {/* Scrollable Body */}
        <div className="sm-scroll" style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', padding: '16px 20px 30px' }}>
          <div style={{ marginBottom: 16, fontSize: 12, color: T.inkMuted, lineHeight: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, paddingRight: 20 }}>
              Manage your standard service offerings. These defaults are used when booking new jobs.
            </div>
            <button
              onClick={handleAdd}
              disabled={loading}
              style={{
                background: loading ? T.pinkTint : T.pink, color: 'white', border: 'none', borderRadius: 8,
                padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: loading ? 'default' : 'pointer'
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
                <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                  <NoServices size={100} />
                  <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, maxWidth: 220, lineHeight: 1.5 }}>
                    No services found. Click "+ Add Service" to start your catalog.
                  </div>
                </div>
              )}
              {formServices.map(s => {
                const isHourly = s.pricing_type === 'Hourly';
                const useDefault = isHourly && s.use_business_default;
                const displayPrice = useDefault ? (business?.hourly_rate || 60) : s.default_price;
                const isPendingDelete = pendingDeleteIds.includes(s.id);

                return (
                  <div key={s.id} style={{ 
                    background: isPendingDelete 
                      ? (mode === 'dark' ? 'rgba(233,30,106,0.05)' : '#FFF0F7') 
                      : T.card, 
                    border: `1.5px solid ${T.cardBorder}`, 
                    borderRadius: 16, padding: '14px', position: 'relative',
                    boxShadow: mode === 'dark' ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
                    opacity: isPendingDelete ? 0.5 : 1,
                    filter: isPendingDelete ? 'grayscale(1)' : 'none',
                    pointerEvents: isPendingDelete ? 'none' : 'auto'
                  }}>
                    {/* Delete Button */}
                    <button
                      onClick={() => handleToggleDelete(s.id)}
                      style={{
                        position: 'absolute', top: 10, right: 10,
                        width: 24, height: 24, borderRadius: 6,
                        background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#FFF0F7',
                        border: 'none', color: T.pink, fontSize: 16, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2,
                        pointerEvents: 'auto'
                      }}
                    >
                      {isPendingDelete ? '↺' : '×'}
                    </button>

                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 9, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Service Name</label>
                        <input 
                          placeholder="e.g. Decluttering"
                          value={s.name} 
                          disabled={isPendingDelete}
                          onChange={e => handleUpdate(s.id, 'name', e.target.value)}
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
                            boxSizing: 'border-box',
                            textDecoration: isPendingDelete ? 'line-through' : 'none'
                          }}
                        />
                      </div>
                      <div style={{ width: 100 }}>
                        <label style={{ fontSize: 9, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Pricing</label>
                        <select 
                          value={s.pricing_type} 
                          disabled={isPendingDelete}
                          onChange={e => handleUpdate(s.id, 'pricing_type', e.target.value)}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ fontSize: 9, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase' }}>
                            {s.pricing_type === 'Hourly' ? 'Rate ($/hr)' : 'Price ($)'}
                          </label>
                          {isHourly && (
                            <button
                              onClick={() => handleUpdate(s.id, 'use_business_default', !s.use_business_default)}
                              disabled={isPendingDelete}
                              title={s.use_business_default ? 'Tap to set a custom rate' : 'Tap to use business default rate'}
                              style={{
                                background: s.use_business_default ? T.pink : 'transparent',
                                border: `1px solid ${T.pink}`,
                                color: s.use_business_default ? 'white' : T.pink,
                                borderRadius: 4, padding: '1px 5px', fontSize: 8, fontWeight: 700, cursor: isPendingDelete ? 'default' : 'pointer'
                              }}
                            >
                              {s.use_business_default ? 'DEFAULT ✎' : 'CUSTOM ✎'}
                            </button>
                          )}
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: useDefault ? (mode === 'dark' ? 'rgba(255,255,255,0.01)' : '#f0f0f0') : (mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#FAF3F6'),
                          padding: '0 10px', borderRadius: '8px 8px 0 0',
                          borderBottom: `2px solid ${T.pink}40`,
                          opacity: useDefault ? 0.7 : 1
                        }}>
                          <span style={{ color: T.inkMuted, fontSize: 14 }}>$</span>
                          <input
                            type="number"
                            value={displayPrice}
                            disabled={useDefault || isPendingDelete}
                            onChange={e => handleUpdate(s.id, 'default_price', e.target.value)}
                            onFocus={e => e.target.select()}
                            style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 0', color: T.ink, fontSize: 15, outline: 'none' }}
                          />
                        </div>
                        {useDefault && (
                          <div style={{ fontSize: 8, color: T.inkMuted, marginTop: 3 }}>
                            Using business default · tap DEFAULT ✎ to customize
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: 9, fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Default Duration (hrs)</label>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#FAF3F6',
                          padding: '0 10px', borderRadius: '8px 8px 0 0',
                          borderBottom: `2px solid ${T.pink}40`,
                        }}>
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={s.default_duration}
                            disabled={isPendingDelete}
                            onChange={e => handleUpdate(s.id, 'default_duration', e.target.value)}
                            onFocus={e => e.target.select()}
                            style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 0', color: T.ink, fontSize: 15, outline: 'none' }}
                          />
                          <span style={{ color: T.inkMuted, fontSize: 10, fontWeight: 700 }}>HRS</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input 
                        type="checkbox" 
                        checked={s.active} 
                        disabled={isPendingDelete}
                        onChange={e => handleUpdate(s.id, 'active', e.target.checked)}
                        style={{ cursor: isPendingDelete ? 'default' : 'pointer' }}
                      />
                      <span style={{ fontSize: 11, color: T.inkSub, fontWeight: 600 }}>Active in catalog</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, padding: '10px', borderRadius: 10, background: T.redBg, color: T.ink, fontSize: 12, border: `1px solid ${T.redBorder}` }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px 24px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 12 }}>
          <button onClick={attemptClose} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: 'transparent', color: T.inkSub, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={busy || loading} style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: (busy || loading) ? T.pinkTint : T.pink, color: 'white', fontSize: 13, fontWeight: 700, cursor: (busy || loading) ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(233,30,106,0.3)' }}>
            {busy ? 'Saving...' : `Save Catalog Changes${isDirty ? ' •' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
