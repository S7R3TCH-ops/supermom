import { useState, useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { createExpense } from '../../data/expensesRepo';
import { notifyDataChanged } from '../../data/useData';
import { useToast } from '../../context/ToastContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardFocus } from '../../hooks/useKeyboardFocus';

const CATEGORIES = [
  { key: 'Supplies',  icon: '🧹' },
  { key: 'Equipment', icon: '🔧' },
  { key: 'Travel',    icon: '🚗' },
  { key: 'Marketing', icon: '📢' },
  { key: 'Other',     icon: '📦' },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NewExpenseSheet({ isOpen, onClose }) {
  const { T, mode } = useAppTheme();
  const toast = useToast();
  const isKeyboardFocused = useKeyboardFocus();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, isOpen, onClose);
  const [category, setCategory] = useState('Supplies');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  function reset() {
    setCategory('Supplies');
    setAmount('');
    setDate(todayISO());
    setNotes('');
    setSaveErr(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setSaveErr('Enter a valid amount.'); return; }
    setSaving(true);
    setSaveErr(null);
    try {
      await createExpense({ category, amount: amt, expense_date: date, notes: notes || null });
      notifyDataChanged();
      toast.success('Expense logged.');
      reset();
      onClose();
    } catch (e) {
      const msg = e.message || 'Could not save expense.';
      setSaveErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Log expense"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.5)',
        animation: 'exFade 180ms ease-out',
      }}
      onClick={handleClose}
    >
      <style>{`
        @keyframes exFade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes exSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg, color: T.ink,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
          maxHeight: '88svh', display: 'flex', flexDirection: 'column',
          animation: 'exSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
          border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, background: '#FFD6E8', borderRadius: 4, opacity: mode === 'dark' ? 0.6 : 1 }} />
        </div>

        {/* Header */}
        <div style={{ padding: '6px 18px 14px' }}>
          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 3 }}>New Expense</div>
          <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>Log an expense</div>
        </div>

        {/* Body */}
        <div className="sm-scroll" style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: `0 18px ${isKeyboardFocused ? '260px' : '6px'}`,
          transition: 'padding-bottom 0.2s ease-out'
        }}>

          {/* Category */}
          <div id="ex-cat-label" style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8 }}>Category</div>
          <div role="group" aria-labelledby="ex-cat-label" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 18 }}>
            {CATEGORIES.map(c => {
              const on = category === c.key;
              return (
                <button key={c.key} role="radio" aria-checked={on} onClick={() => setCategory(c.key)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 4px', borderRadius: 12,
                  border: `1.5px solid ${on ? '#F59E0B' : T.cardBorder}`,
                  background: on ? '#FEF3C7' : T.card,
                  cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 18 }}>{c.icon}</span>
                  <span style={{ fontFamily: T.font, fontSize: 8.5, fontWeight: 700, color: on ? '#78350F' : T.inkMuted, letterSpacing: '0.3px' }}>{c.key}</span>
                </button>
              );
            })}
          </div>

          {/* Amount */}
          <label htmlFor="ex-amount" style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8, display: 'block' }}>Amount</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
            <span style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.inkSub }}>$</span>
            <input
              id="ex-amount"
              type="number"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              inputMode="decimal"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: T.ink, fontVariantNumeric: 'tabular-nums' }}
            />
          </div>

          {/* Date */}
          <label htmlFor="ex-date" style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8, display: 'block' }}>Date</label>
          <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
            <input
              id="ex-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: T.font, fontSize: 13, fontWeight: 500, color: T.ink, width: '100%' }}
            />
          </div>

          {/* Notes */}
          <label htmlFor="ex-notes" style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8, display: 'block' }}>Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
            <textarea
              id="ex-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. gas to Brampton, cleaning supplies from Walmart"
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontFamily: T.font, fontSize: 13, color: T.ink, resize: 'none', minHeight: 56, lineHeight: 1.45 }}
            />
          </div>

          {saveErr && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #FECACA', fontFamily: T.font, fontSize: 11.5, color: '#991B1B', marginBottom: 12 }}>
              {saveErr}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px 24px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', gap: 10, background: T.bg }}>
          <button
            onClick={handleClose}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.card, color: T.inkSub, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: saving ? '#F9C5DB' : '#E91E6A', color: 'white', fontFamily: T.font, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 4px 12px rgba(233,30,106,0.3)' }}
          >
            {saving ? 'Saving…' : 'Log Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}
