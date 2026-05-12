# Step 3 Design Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `NewJobSheet.jsx` Step 3 review to match `DESIGN.md` guidelines for Dark Hero treatment and conflict card colors.

**Architecture:** Update inline styles in `Step3Review` and `ConflictWarning` components to use CSS variables and theme tokens.

**Tech Stack:** React, CSS Variables, Theme Context.

---

### Task 1: Update Conflict Warning Card

**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx`

- [ ] **Step 1: Replace hardcoded colors in Conflict Warning Card**

Update the conflict warning card to use `var(--amber-light)`, `var(--amber)`, and `var(--amber-text)`.

```jsx
// Search for:
        <div style={{ 
          padding: '14px', borderRadius: 16, background: '#FFF7ED', 
          border: '1.5px solid #FDBA74', display: 'flex', flexDirection: 'column', gap: 8 
        }}>

// Replace with:
        <div style={{ 
          padding: '14px', borderRadius: 16, background: 'var(--amber-light)', 
          border: '1.5px solid var(--amber)', display: 'flex', flexDirection: 'column', gap: 8 
        }}>
```
Also update the labels and text colors inside it to use amber variables if they are hardcoded.

### Task 2: Update Summary Header to "Dark Hero"

**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx`

- [ ] **Step 1: Transform summary card into a Dark Hero section**

Update the summary card in `Step3Review` to use `var(--grad-hero)`, `var(--border-hero)`, and appropriate text colors.

```jsx
// Search for:
      <div style={{ padding: '16px', background: T.card, borderRadius: 16, border: `1px solid ${T.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700 }}>Client</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{selectedClient?.firstName} {selectedClient?.lastName}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700 }}>Mission</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{service?.name}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700 }}>Date</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{date}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700 }}>Time</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{time}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700 }}>Recurrence</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{recurrence || 'One-time'}</div>
        </div>
      </div>

// Replace with:
      <div style={{ 
        padding: '16px 20px', 
        background: 'var(--grad-hero)', 
        borderBottom: 'var(--border-hero)', 
        margin: '0 -20px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 12,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle,rgba(233,30,106,.22) 0%,transparent 70%)`, pointerEvents: 'none' }} />
        
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'var(--pink-label)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px' }}>Client</div>
          <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, color: 'white' }}>{selectedClient?.firstName} {selectedClient?.lastName}</div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'var(--pink-label)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px' }}>Mission</div>
          <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, color: 'white' }}>{service?.name}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, position: 'relative' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--pink-label)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px' }}>Date</div>
            <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: 'white' }}>{date}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--pink-label)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px' }}>Time</div>
            <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: 'white' }}>{time}</div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'var(--pink-label)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.2px' }}>Recurrence</div>
          <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: 'white' }}>{recurrence || 'One-time'}</div>
        </div>
      </div>
```

---
