import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useToast } from '../../context/ToastContext';
import { notifyDataChanged } from '../../data/useData';
import {
  fetchWorkersWithSkills, createWorker, updateWorker, archiveWorker,
  fetchSkillTypes, createSkillType, updateSkillType, deleteSkillType,
  fetchWorkerSkills, setWorkerSkills,
} from '../../data/workersRepo';
import { SectionLabel } from '../ui/typography';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import GrabBar from '../ui/GrabBar';

const BLANK = { name: '', phone: '', email: '', person_type: 'worker' };

export default function WorkerCatalogSheet({ isOpen, onClose }) {
  const { T, mode } = useAppTheme();
  const toast = useToast();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, isOpen, onClose);

  const [activeTab, setActiveTab] = useState('worker');
  const [workers, setWorkers] = useState([]);
  const [skillTypes, setSkillTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | worker-id
  const [form, setForm] = useState(BLANK);
  const [selectedSkills, setSelectedSkills] = useState([]); // [{ skill_type_id, pay_rate }]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Skill catalog management state
  const [editingSkillType, setEditingSkillType] = useState(null); // null | 'new' | skill_type_id
  const [skillTypeForm, setSkillTypeForm] = useState('');
  const [skillTypeBusy, setSkillTypeBusy] = useState(false);
  const [showSkillCatalog, setShowSkillCatalog] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ws, sts] = await Promise.all([
        fetchWorkersWithSkills().catch(() => []),
        fetchSkillTypes().catch(() => []),
      ]);
      setWorkers(ws);
      setSkillTypes(sts);
    } catch (e) {
      toast.error('Failed to load team');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  function startNew() {
    setForm({ ...BLANK, person_type: activeTab });
    setSelectedSkills([]);
    setErr('');
    setEditing('new');
  }

  async function startEdit(w) {
    setForm({ name: w.name || '', phone: w.phone || '', email: w.email || '', person_type: w.person_type || 'worker' });
    setErr('');
    setEditing(w.id);
    // Load existing skills for this worker
    try {
      const skills = await fetchWorkerSkills(w.id).catch(() => []);
      setSelectedSkills(skills.map(s => ({ skill_type_id: s.skill_type_id, pay_rate: s.pay_rate != null ? String(s.pay_rate) : '' })));
    } catch {
      setSelectedSkills([]);
    }
  }

  function cancelEdit() {
    setEditing(null);
    setSelectedSkills([]);
    setErr('');
  }

  function toggleSkill(skillTypeId) {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.skill_type_id === skillTypeId);
      if (exists) return prev.filter(s => s.skill_type_id !== skillTypeId);
      return [...prev, { skill_type_id: skillTypeId, pay_rate: '' }];
    });
  }

  function setSkillPay(skillTypeId, pay) {
    setSelectedSkills(prev => prev.map(s => s.skill_type_id === skillTypeId ? { ...s, pay_rate: pay } : s));
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    setBusy(true); setErr('');
    try {
      let savedId = editing;
      if (editing === 'new') {
        const w = await createWorker({
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          person_type: form.person_type,
        });
        savedId = w.id;
        toast.success(`${form.person_type === 'staff' ? 'Staff' : 'Worker'} added!`);
      } else {
        await updateWorker(editing, {
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          person_type: form.person_type,
        });
        toast.success('Updated!');
      }
      // Save skills
      const skillsToSave = selectedSkills.filter(s => s.skill_type_id);
      await setWorkerSkills(savedId, skillsToSave).catch(() => {});
      notifyDataChanged();
      setEditing(null);
      setSelectedSkills([]);
      refresh();
    } catch (e) {
      setErr(e.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(id, name) {
    if (!window.confirm(`Archive ${name}? They'll no longer appear in the picker, but past jobs are unchanged.`)) return;
    try {
      await archiveWorker(id);
      toast.success('Archived.');
      notifyDataChanged();
      refresh();
    } catch {
      toast.error('Archive failed.');
    }
  }

  // Skill catalog handlers
  async function handleSaveSkillType() {
    if (!skillTypeForm.trim()) return;
    setSkillTypeBusy(true);
    try {
      if (editingSkillType === 'new') {
        await createSkillType(skillTypeForm.trim());
        toast.success('Skill type added!');
      } else {
        await updateSkillType(editingSkillType, skillTypeForm.trim());
        toast.success('Skill type updated!');
      }
      notifyDataChanged();
      setEditingSkillType(null);
      setSkillTypeForm('');
      refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to save skill type.');
    } finally {
      setSkillTypeBusy(false);
    }
  }

  async function handleDeleteSkillType(id, name) {
    if (!window.confirm(`Delete skill type "${name}"? Workers currently assigned this skill will lose it.`)) return;
    try {
      await deleteSkillType(id);
      toast.success('Skill type deleted.');
      notifyDataChanged();
      refresh();
    } catch {
      toast.error('Delete failed.');
    }
  }

  if (!isOpen) return null;

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 11px', borderRadius: 'var(--r-input)',
    border: `1.5px solid ${T.cardBorder}`,
    fontSize: 13, color: T.ink,
    background: T.card, outline: 'none',
    fontFamily: T.font,
  };

  const filtered = workers.filter(w => (w.person_type || 'worker') === activeTab && !w.deleted_at);
  const tabLabel = activeTab === 'staff' ? 'Staff' : 'Workers';

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Manage team"
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(4,1,12,0.65)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg, width: '100%', maxWidth: 500, margin: '0 auto',
          maxHeight: '92svh', borderTopLeftRadius: 24, borderTopRightRadius: 24,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
        }}
      >
        <GrabBar onDismiss={onClose} />

        {/* Header */}
        <div style={{
          background: T.hero,
          borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none',
          padding: '10px 18px 14px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -20, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink, marginBottom: 6, position: 'relative' }}>✦ Team</div>
          <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: mode === 'dark' ? 'white' : T.ink, position: 'relative' }}>Team Management</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.cardBorder}`, flexShrink: 0 }}>
          {['worker', 'staff'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setEditing(null); setSelectedSkills([]); }}
              style={{
                flex: 1, padding: '11px 0', border: 'none', outline: 'none', cursor: 'pointer',
                background: 'transparent',
                fontFamily: T.font, fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.8px',
                color: activeTab === tab ? T.pink : T.inkMuted,
                borderBottom: activeTab === tab ? `2.5px solid ${T.pink}` : '2.5px solid transparent',
              }}
            >
              {tab === 'worker' ? '👷 Workers' : '⭐ Staff'}
            </button>
          ))}
        </div>

        <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 24px' }}>

          {/* Staff note */}
          {activeTab === 'staff' && (
            <div style={{ background: T.pinkTint, border: `1px solid ${T.pink}22`, borderRadius: 10, padding: '9px 12px', marginBottom: 14, fontSize: 11, color: T.pink, fontFamily: T.font }}>
              Staff will receive app access in a future update. For now, they can be assigned to jobs like workers.
            </div>
          )}

          {/* Edit / New form */}
          {editing && (
            <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: T.pink, marginBottom: 12 }}>
                {editing === 'new' ? `Add ${tabLabel.slice(0, -1)}` : `Edit ${tabLabel.slice(0, -1)}`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 9.5, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Full name" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 9.5, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Phone</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} placeholder="(416) 555-0000" />
                  </div>
                  <div>
                    <label style={{ fontSize: 9.5, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Email</label>
                    <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} placeholder="email@example.com" type="email" />
                  </div>
                </div>

                {/* Skills picker */}
                {skillTypes.length > 0 && (
                  <div>
                    <label style={{ fontSize: 9.5, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Skills & Pay Rates</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {skillTypes.map(st => {
                        const sel = selectedSkills.find(s => s.skill_type_id === st.id);
                        return (
                          <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => toggleSkill(st.id)}
                              style={{
                                flexShrink: 0, width: 20, height: 20, borderRadius: 5,
                                border: `2px solid ${sel ? T.pink : T.cardBorder}`,
                                background: sel ? T.pink : 'transparent',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {sel && <span style={{ color: 'white', fontSize: 11, lineHeight: 1 }}>✓</span>}
                            </button>
                            <span style={{ fontFamily: T.font, fontSize: 12.5, color: sel ? T.ink : T.inkMuted, flex: 1 }}>{st.name}</span>
                            {sel && (
                              <div style={{ position: 'relative', width: 90 }}>
                                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: T.inkMuted, fontSize: 12 }}>$</span>
                                <input
                                  type="number"
                                  value={sel.pay_rate}
                                  onChange={e => setSkillPay(st.id, e.target.value)}
                                  placeholder="0.00"
                                  style={{ ...inputStyle, padding: '6px 8px 6px 20px', fontSize: 12 }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {skillTypes.length === 0 && (
                  <div style={{ fontSize: 11, color: T.inkMuted, fontStyle: 'italic', fontFamily: T.font }}>
                    No skill types yet. Add some in the Skill Catalog section below.
                  </div>
                )}
              </div>
              {err && <div style={{ marginTop: 8, fontSize: 11, color: '#EF4444', fontFamily: T.font }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={cancelEdit} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted, fontFamily: T.font, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSave} disabled={busy} style={{ flex: 2, padding: '10px', borderRadius: 10, background: busy ? T.pinkTint : T.pink, border: 'none', color: 'white', fontFamily: T.font, fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
                  {busy ? 'Saving…' : editing === 'new' ? `Add ${tabLabel.slice(0, -1)}` : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Add button */}
          {!editing && (
            <button onClick={startNew} style={{ width: '100%', padding: '12px', borderRadius: 12, background: T.pinkTint, border: `1.5px dashed ${T.pink}`, color: T.pink, fontFamily: T.font, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
              + ADD {activeTab === 'staff' ? 'STAFF' : 'WORKER'}
            </button>
          )}

          {/* List */}
          <SectionLabel>{tabLabel} ({filtered.length})</SectionLabel>
          {loading && <div style={{ padding: 16, textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>No {tabLabel.toLowerCase()} yet. Add your first one above.</div>
          )}
          {filtered.map(w => (
            <div key={w.id} style={{ background: T.card, border: `1.5px solid ${editing === w.id ? T.pink : T.cardBorder}`, borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: T.ink }}>{w.name}</div>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', padding: '2px 6px', borderRadius: 4, background: w.person_type === 'staff' ? 'rgba(139,92,246,0.12)' : 'rgba(233,30,106,0.10)', color: w.person_type === 'staff' ? '#8B5CF6' : T.pink }}>
                      {w.person_type === 'staff' ? 'Staff' : 'Worker'}
                    </span>
                  </div>
                  {w.skills && w.skills.length > 0 && (
                    <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkMuted, marginTop: 3 }}>
                      {w.skills.map(s => `${s.skill_name}${s.pay_rate != null ? ` · $${Number(s.pay_rate).toFixed(0)}/job` : ''}`).join('  ·  ')}
                    </div>
                  )}
                  {(w.phone || w.email) && (
                    <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkMuted, marginTop: 2 }}>
                      {[w.phone, w.email].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => startEdit(w)} style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted, fontFamily: T.font, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => handleArchive(w.id, w.name)} style={{ padding: '6px 10px', borderRadius: 8, background: 'transparent', border: '1.5px solid #EF4444', color: '#EF4444', fontFamily: T.font, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Archive</button>
                </div>
              </div>
            </div>
          ))}

          {/* Skill Catalog section */}
          <div style={{ marginTop: 24 }}>
            <button
              onClick={() => setShowSkillCatalog(s => !s)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <span style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: T.inkMuted }}>Skill Catalog ({skillTypes.length})</span>
              <span style={{ fontSize: 12, color: T.inkMuted }}>{showSkillCatalog ? '▲' : '▼'}</span>
            </button>

            {showSkillCatalog && (
              <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 14, padding: 14, marginTop: 4 }}>
                <div style={{ fontSize: 10, color: T.inkMuted, fontFamily: T.font, marginBottom: 10 }}>
                  Skill types are shared across all workers. Add the types of work your team performs, then assign them to individual workers with their pay rates.
                </div>

                {/* Add / Edit form */}
                {editingSkillType && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <input
                      value={skillTypeForm}
                      onChange={e => setSkillTypeForm(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveSkillType(); if (e.key === 'Escape') { setEditingSkillType(null); setSkillTypeForm(''); } }}
                      placeholder="Skill name (e.g. Organizing)"
                      autoFocus
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button onClick={handleSaveSkillType} disabled={skillTypeBusy || !skillTypeForm.trim()} style={{ padding: '8px 14px', borderRadius: 8, background: T.pink, border: 'none', color: 'white', fontFamily: T.font, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {skillTypeBusy ? '…' : editingSkillType === 'new' ? 'Add' : 'Save'}
                    </button>
                    <button onClick={() => { setEditingSkillType(null); setSkillTypeForm(''); }} style={{ padding: '8px 10px', borderRadius: 8, background: 'transparent', border: `1.5px solid ${T.cardBorder}`, color: T.inkMuted, fontFamily: T.font, fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </div>
                )}

                {skillTypes.map(st => (
                  <div key={st.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                    <span style={{ fontFamily: T.font, fontSize: 12.5, color: T.ink }}>{st.name}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditingSkillType(st.id); setSkillTypeForm(st.name); }} style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: `1px solid ${T.cardBorder}`, color: T.inkMuted, fontFamily: T.font, fontSize: 10.5, cursor: 'pointer' }}>Rename</button>
                      <button onClick={() => handleDeleteSkillType(st.id, st.name)} style={{ padding: '4px 8px', borderRadius: 6, background: 'transparent', border: '1px solid #EF4444', color: '#EF4444', fontFamily: T.font, fontSize: 10.5, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
                {skillTypes.length === 0 && !editingSkillType && (
                  <div style={{ fontSize: 11, color: T.inkMuted, fontFamily: T.font, textAlign: 'center', padding: '8px 0' }}>No skill types yet.</div>
                )}

                {!editingSkillType && (
                  <button onClick={() => { setEditingSkillType('new'); setSkillTypeForm(''); }} style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 8, background: 'transparent', border: `1.5px dashed ${T.cardBorder}`, color: T.inkMuted, fontFamily: T.font, fontSize: 12, cursor: 'pointer' }}>
                    + Add Skill Type
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
