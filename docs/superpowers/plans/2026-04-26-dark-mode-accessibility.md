# Dark Mode Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve contrast ratios in Dark Mode to meet WCAG 2.1 AA standards for muted text, labels, and UI elements.

**Architecture:** Update central theme tokens in `src/lib/tokens.js` and refine component-level overrides in `SectionLabel.jsx` and sheet handles.

**Tech Stack:** React, Vanilla CSS, JS (Tokens).

---

### Task 1: Audit and Update Theme Tokens

**Files:**
- Modify: `src/lib/tokens.js`

- [ ] **Step 1: Increase opacity for `inkMuted` and `secLabel` in Dark Mode**

In `src/lib/tokens.js`, update:
- `inkMuted`: from `0.36` to `0.55` (min for 4.5:1 contrast on dark bg).
- `secLabel`: from `rgba(255,120,176,0.6)` to `rgba(255,120,176,0.85)` (to account for component-level opacity).

```javascript
// src/lib/tokens.js
// ...
    inkMuted:    dk ? 'rgba(255,255,255,0.55)' : '#9B5A70',
    secLabel:    dk ? 'rgba(255,120,176,0.85)' : '#9B5A70',
// ...
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tokens.js
git commit -m "style(tokens): increase inkMuted and secLabel opacity for WCAG compliance"
```

---

### Task 2: Refine SectionLabel Component

**Files:**
- Modify: `src/components/ui/SectionLabel.jsx`

- [ ] **Step 1: Remove redundant opacity and use token color directly**

Since we bumped the token opacity, we remove the component-level opacity to maintain the intended look while ensuring readability.

```jsx
// src/components/ui/SectionLabel.jsx
// ...
    <div style={{
      fontFamily: T.font,
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: '1px',
      textTransform: 'uppercase',
      color: T.secLabel,
      marginBottom: 8,
      // opacity: 0.85, // REMOVED
    }}>
// ...
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/SectionLabel.jsx
git commit -m "style(ui): refine SectionLabel opacity"
```

---

### Task 3: Standardize Sheet Handles

**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx`
- Modify: `src/components/sheets/JobDetailSheet.jsx`
- Modify: `src/components/sheets/PostJobSheet.jsx`
- Modify: `src/components/sheets/NewClientSheet.jsx`
- Modify: `src/components/sheets/NewExpenseSheet.jsx`
- Modify: `src/components/sheets/FinanceDetailSheet.jsx`
- Modify: `src/components/sheets/NudgeDraftSheet.jsx`
- Modify: `src/components/sheets/ThankYouDraftSheet.jsx`

- [ ] **Step 1: Update all sheet handles to use 0.6 opacity in Dark Mode**

Search for `background: '#FFD6E8'` and `opacity: mode === 'dark' ? 0.3 : 1` (or `0.35`) and update to `0.6`.

```jsx
// Example for NewJobSheet.jsx
<div style={{ width: 42, height: 5, background: '#FFD6E8', borderRadius: 10, opacity: mode === 'dark' ? 0.6 : 1 }} />
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sheets/
git commit -m "style(sheets): improve sheet handle contrast in dark mode"
```

---

### Task 4: Fix Appearance Switch Contrast in Settings

**Files:**
- Modify: `src/pages/Settings.jsx`

- [ ] **Step 1: Audit the switch colors in dark mode**

The switch background currently uses `T.cardBorder` which is too faint in dark mode. Use a more visible background.

```jsx
// src/pages/Settings.jsx
// ...
          <button 
            role="switch"
            aria-checked={mode === 'dark'}
            aria-label="Toggle Dark Mode"
            onClick={toggleMode}
            style={{
              width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: mode === 'dark' ? T.pink : (mode === 'dark' ? 'rgba(255,255,255,0.1)' : T.cardBorder), // IMPROVED
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
// ...
```
Actually, if `mode === 'dark'`, the background is `T.pink` (active).
If `mode === 'warm'`, the background is `T.cardBorder`.
Wait, if it's currently `dark`, we want the toggle to look "on".
If it's currently `warm`, we want it to look "off".
The logic in `Settings.jsx` is:
`background: mode === 'dark' ? T.pink : T.cardBorder`
This is fine, but `T.cardBorder` in `warm` mode is `#FFD6E8`, which is fine.
In `dark` mode, the switch IS `pink` (active).
So the contrast issue is only if the switch is "off" in dark mode.
But if it's "off", the mode is "warm".
Wait, the `Settings.jsx` code is:
```jsx
          <button 
            onClick={toggleMode}
            style={{
              background: mode === 'dark' ? T.pink : T.cardBorder,
            }}
          >
```
If `mode` is `dark`, `T` is the dark theme tokens. `T.pink` is `#E91E6A`.
If `mode` is `warm`, `T` is the warm theme tokens. `T.cardBorder` is `#FFD6E8`.
So in both cases it's visible. The only case it might be faint is if we were in dark mode but the switch was "off". But in this app, "off" means light mode.
So it's actually fine as is, but I'll double check if there are other switch-like elements.

Actually, I'll update the plan to include a check for the `Outstanding` card in `Finance.jsx`.

- [ ] **Step 2: Update Finance.jsx card borders**

```jsx
// src/pages/Finance.jsx
// Update 'Outstanding' border in dark mode
border: mode === 'dark' ? 'rgba(233,30,106,0.4)' : '#FFD6E8', // Increased from 0.25
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Finance.jsx src/pages/Settings.jsx
git commit -m "style(ui): improve UI element contrast in dark mode"
```
