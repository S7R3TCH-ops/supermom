# Vibrant Papaya UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Supermom UI to the "Vibrant Papaya" aesthetic, featuring a bold organic pink (#FF70A6), warm cream backgrounds (#FFF9F5), and editorial serif typography.

**Architecture:** We will update the design tokens in `src/lib/tokens.js`, refresh global CSS in `src/index.css`, and perform a surgical polish pass across key components (LogoBar, FAB, Cards) to ensure the "Bold yet Airy" feel is achieved.

**Tech Stack:** React (Vite), Tailwind CSS (for layout utilities), Vanilla CSS (for theme-aware styling), Fraunces & Inter fonts.

---

### Task 1: Update Design Tokens

**Files:**
- Modify: `src/lib/tokens.js`
- Test: Manual visual check of Home screen colors.

- [ ] **Step 1: Update `smTokens` with new color palette**

```javascript
// src/lib/tokens.js
export function smTokens(mode) {
  const dk = mode !== 'warm';
  return {
    bg:          dk ? '#0A0A0A' : '#FFF9F5', // NEW: Warm Cream
    surface:     dk ? '#1C1C1E' : '#FDF6F0', // NEW: Softer surface
    card:        dk ? '#2C2C2E' : '#FFFFFF',
    cardBorder:  dk ? 'rgba(255,112,166,0.2)' : '#FFD6E8', // NEW: Refined border
    hero:        'linear-gradient(145deg,#1C1C1E 0%,#2C2C2E 100%)',
    navBg:       dk ? '#0A0A0A' : '#FFF9F5',
    navBorder:   dk ? 'rgba(255,112,166,0.2)' : '#FFD6E8',
    pink:        '#FF70A6',   // NEW: Vibrant Papaya
    pinkLight:   '#FF94BC',   // NEW: Softer glow
    pinkLabel:   '#FF78B0',
    pinkGlow:    'rgba(255,112,166,0.2)',
    pinkTint:    dk ? 'rgba(255,112,166,0.1)' : '#FFF0F7',
    amberBg:     dk ? 'rgba(245,158,11,0.1)' : '#FEF3C7',
    amberBorder: dk ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.4)',
    redBg:       dk ? 'rgba(220,38,38,0.08)' : '#FFF1F1',
    redBorder:   dk ? 'rgba(220,38,38,0.22)' : '#FCA5A540',
    ink:         dk ? '#FFFFFF'                : '#1C1C1E',
    inkSub:      dk ? 'rgba(255,255,255,0.65)' : '#4A4A4A',
    inkMuted:    dk ? 'rgba(255,255,255,0.55)' : '#8A8A8E',
    secLabel:    dk ? 'rgba(255,112,166,0.85)' : '#8A8A8E',
    font:        "'Inter', system-ui, sans-serif",
    serif:       "'Fraunces', Georgia, serif",
  };
}
```

- [ ] **Step 2: Commit changes**

```bash
git add src/lib/tokens.js
git commit -m "style: update design tokens to Vibrant Papaya palette"
```

---

### Task 2: Global CSS & Whitespace Refresh

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Increase global padding and whitespace**

```css
/* src/index.css */
/* Update global padding from 14px to 18px where applicable */
body {
  background-color: var(--bg); /* Will now resolve to #FFF9F5 in light mode */
}

.page-container {
  padding-left: 18px;
  padding-right: 18px;
}

/* Softer shadows for cards */
.card-shadow {
  box-shadow: 0 4px 12px rgba(255, 112, 166, 0.08);
}
```

- [ ] **Step 2: Commit changes**

```bash
git add src/index.css
git commit -m "style: increase global padding and soften card shadows"
```

---

### Task 3: Editorial Typography Pass

**Files:**
- Modify: `src/components/ui/typography/Title.jsx`
- Modify: `src/components/ui/typography/Subheading.jsx`

- [ ] **Step 1: Shift Typography defaults to favor Serif (Fraunces)**

```javascript
// src/components/ui/typography/Title.jsx
// Ensure it defaults to serif and has refined spacing
export const Title = ({ children, className = '', serif = true, ...props }) => {
  return (
    <h1 
      className={`text-2xl font-medium tracking-tight ${serif ? 'font-serif' : 'font-sans'} ${className}`}
      {...props}
    >
      {children}
    </h1>
  );
};
```

- [ ] **Step 2: Commit changes**

```bash
git add src/components/ui/typography/
git commit -m "style: emphasize serif typography for editorial feel"
```

---

### Task 4: Component Polish (LogoBar & FAB)

**Files:**
- Modify: `src/components/layout/LogoBar.jsx`
- Modify: `src/components/ui/FAB.jsx`

- [ ] **Step 1: Update LogoBar gradient to use Vibrant Papaya**

```javascript
// src/components/layout/LogoBar.jsx
// Update styles to use new pink token
const barStyle = {
  background: `linear-gradient(135deg, ${T.pink}, ${T.pinkLight})`,
  padding: '10px 18px 12px', // Increased "breath"
};
```

- [ ] **Step 2: Update FAB to use new bold pink and white border**

```javascript
// src/components/ui/FAB.jsx
const fabStyle = {
  background: T.pink,
  border: '2px solid white',
  box-shadow: '0 8px 22px rgba(255,112,166,0.4)',
};
```

- [ ] **Step 3: Commit changes**

```bash
git add src/components/layout/LogoBar.jsx src/components/ui/FAB.jsx
git commit -m "style: refresh LogoBar and FAB with Vibrant Papaya styling"
```

---

### Task 5: Documentation Update

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: Update DESIGN.md with new tokens and rules**

```markdown
/* Update CSS Custom Properties section in DESIGN.md */
--pink: #FF70A6;
--pink-pale: #FFF9F5;
...
```

- [ ] **Step 2: Commit changes**

```bash
git add DESIGN.md
git commit -m "docs: update DESIGN.md with Vibrant Papaya specifications"
```
