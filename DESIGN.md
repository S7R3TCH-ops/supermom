# Supermom for Hire · Design System

> This file is the single source of truth for all visual decisions.
> Read this before writing any component, styling any element, or making any layout choice.

---

## Brand direction

**Zen but powerful. Superhuman-adjacent.** Warm, confident, clean. The app should make the operator feel like they have a team of 10 behind them. Tasteful superhero energy — not cartoon, not toy-like. Premium solo-operator tooling.

**The one thing someone will remember:** A glowing dark interface that feels like a mission control for a solo superhero operation — with a bright pink heart.

---

## CSS Custom Properties (copy into `:root`)

```css
:root {
  /* Brand */
  --pink:          #E91E6A;   /* primary action, CTAs, active nav */
  --pink-light:    #FF5A9D;   /* gradient start, avatar backgrounds */
  --pink-mid:      #B01550;   /* hover states, destructive actions */
  --pink-pale:     #FFF9FB;   /* app background, screen base */
  --pink-tint:     #FFF0F7;   /* selected state backgrounds */
  --pink-border:   #FFD6E8;   /* ALL card borders, input borders */
  --pink-label:    #FF78B0;   /* labels/text on dark backgrounds */

  /* Plum (dark sections) */
  --plum-dark:     #1A0A12;   /* hero sections, dark headers, FAB bg */
  --plum-mid:      #2C0B1A;   /* toggle backgrounds, hero gradient end */

  /* Ink (text on light backgrounds) */
  --ink:           #1A0A12;   /* primary text */
  --ink-mid:       #5A3040;   /* secondary text, meta */
  --ink-muted:     #9B5A70;   /* placeholders, tertiary */

  /* Status */
  --green:         #16A34A;   /* paid, GCal synced, positive */
  --green-light:   #DCFCE7;   /* paid card background */
  --green-border:  #86EFAC;   /* paid card border */
  --green-text:    #14532D;   /* paid text */
  --amber:         #F59E0B;   /* conflict warnings, overdue */
  --amber-light:   #FEF3C7;   /* conflict card background */
  --amber-text:    #78350F;   /* conflict text */

  /* Gradients — use ONLY these three */
  --grad-pink:   linear-gradient(110deg, #FF4D96 0%, #E91E6A 45%, #B01550 100%);
  --grad-hero:   linear-gradient(145deg, #1A0A12 0%, #2C0B1A 100%);
  --grad-action: linear-gradient(135deg, #FF5A9D, #E91E6A);

  /* Border radius */
  --r-card:    16px;   /* cards, job rows, client rows */
  --r-input:   12px;   /* inputs, date pickers, small buttons */
  --r-badge:   5px;    /* all status badges and tags */
  --r-sheet:   24px;   /* bottom sheet top corners */
  --r-pill:    100px;  /* chips, filter pills */

  /* Borders */
  --border-card: 1.5px solid #FFD6E8;   /* use this, not raw value */
  --border-hero: 3px solid #E91E6A;     /* bottom border on ALL dark hero sections */

  /* Typography */
  --font-display: 'Fraunces', Georgia, serif;
  --font-ui:      'Inter', system-ui, sans-serif;

  /* Shadows */
  --shadow-card: 0 2px 12px rgba(233,30,106,.08);
  --shadow-fab:  0 8px 22px rgba(233,30,106,.4);
}
```

---

## Typography

### Fonts
- **Fraunces** (serif) — display, names, amounts, hero text, all money values
- **Inter** — all UI text, labels, meta, buttons, body

```
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');
```

### Type scale

| Role | Font | Size | Weight | Letter-spacing | Color |
|---|---|---|---|---|---|
| App greeting name | Fraunces | 28px | 500 | -0.6px | `--ink` |
| Hero job title | Fraunces | 21px | 500 | -0.3px | white |
| Client name (profile) | Fraunces | 22px | 500 | -0.4px | white (on dark) |
| Client name (card) | Fraunces | 14px | 500 | -0.2px | `--ink` |
| Dollar amount (large hero) | Fraunces | 44px | 500 | -2px | white |
| Dollar amount (card) | Fraunces | 22px | 500 | -0.5px | contextual |
| Dollar amount (inline) | Fraunces | 13px | 500 | 0 | contextual |
| Section title | Fraunces | 14px | 500 | -0.2px | `--ink` |
| Section label | Inter | 10px | 700 | 0.7px | `--ink-mid`, UPPERCASE |
| AI card label | Inter | 9.5px | 700 | 1.1px | `--pink-label`, UPPERCASE |
| Badge / tag | Inter | 9px | 700 | 0.4px | contextual |
| Body text | Inter | 12–13px | 500 | 0 | `--ink-mid` |
| Meta / sub-label | Inter | 10.5–11.5px | 500 | 0 | `--ink-mid` |
| Button (primary) | Inter | 13px | 700 | 0 | white |
| Button (secondary) | Inter | 12px | 600 | 0 | `--ink` |

**Rule:** All dollar amounts use `font-variant-numeric: tabular-nums`.

---

## Spacing

| Location | Value |
|---|---|
| Screen horizontal padding | `0 14px` |
| Card content padding | `12px 14px` |
| Dark hero section padding | `16px 18px` |
| Logo banner padding | `10px 16px 12px` |
| Bottom sheet body padding | `6px 18px 14px` |
| Section header padding | `12px 18px 0` |
| FAB position | `bottom: 56px; right: 14px` |
| Minimum tap target | `44×44px` |

---

## Components

### 1. Logo Banner (every screen — identical)

```jsx
// Sits below status bar, above all content on every screen
// In production: replace SVG with <img src="/supermom_logo_wide.png" />
<div className="logo-bar" style={{
  background: 'var(--grad-pink)',
  padding: '10px 16px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0
}}>
  <img src="/supermom_logo_wide.png" alt="Supermom for Hire" height="40" />
  <div className="avatar-pill">S</div>
</div>
```

**Rule:** This component is 100% identical on every screen. No exceptions. No variants.

---

### 2. Dark Hero Section

Used on: Client profile, Finance, New Job review, Home Today card (morning state)

```css
.hero-section {
  background: var(--grad-hero);        /* ALWAYS this gradient */
  border-bottom: var(--border-hero);   /* ALWAYS 3px pink bottom border */
  padding: 16px 18px;
  position: relative;
  overflow: hidden;
}
/* Radial glow — always present */
.hero-section::before {
  content: '';
  position: absolute;
  top: -60px; right: -40px;
  width: 180px; height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(233,30,106,.22) 0%, transparent 65%);
  pointer-events: none;
}
```

**Rule:** The 3px pink `border-bottom` is what visually separates the dark hero from the pink logo banner above. Never skip it. Never show a pink section directly touching the pink banner.

Hero label (the small uppercase text above the main content):
```css
.hero-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--pink-label);   /* #FF78B0 — always this, no exceptions */
}
```

---

### 3. Standard Card

```css
.card {
  background: white;
  border: var(--border-card);    /* 1.5px solid #FFD6E8 */
  border-radius: var(--r-card);  /* 16px */
  padding: 12px 14px;
  margin-bottom: 7px;
}
```

Variants:
- **VIP card:** `border-color: #FCD34D; background: linear-gradient(135deg, #FFFBEB 0%, white 100%)`
- **Owing card:** `border-color: #F472B6`
- **Paid card:** `border-color: #86EFAC; background: #F0FFF5`
- **Next up card:** `border-color: var(--pink); background: var(--pink-tint)`
- **Conflict card:** `border-color: var(--amber); background: #FFFBEB`

---

### 4. AI Assistant Card

Used contextually on every screen. Always dark plum, never white.

```css
.ai-card {
  background: var(--grad-hero);
  border-radius: var(--r-card);
  padding: 13px;
  display: flex;
  gap: 11px;
  position: relative;
  overflow: hidden;
}
.ai-card::before {
  content: '';
  position: absolute;
  top: -30px; right: -20px;
  width: 90px; height: 90px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(233,30,106,.22) 0%, transparent 70%);
}
```

AI icon: `28×28px`, `border-radius: 9px`, `background: var(--grad-action)`

AI label anatomy (always):
```
✦ [LABEL TEXT]     ← font-size: 9.5px, weight: 700, letter-spacing: 1.1px, UPPERCASE, color: #FF78B0
```

Button anatomy inside AI card:
- Primary CTA: `background: var(--pink)`, white text
- Secondary: `background: rgba(255,255,255,.1)`, `border: 1px solid rgba(255,255,255,.15)`, white text

---

### 5. Section Label

```css
.section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: var(--ink-mid);    /* #5A3040 */
  margin: 14px 0 7px;
}
.section-label:first-child { margin-top: 6px; }
```

---

### 6. Badges & Tags

```css
.badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 5px;     /* var(--r-badge) */
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
```

| Badge | Background | Text color |
|---|---|---|
| UNPAID | `#FFE0EC` | `#9B0D3A` |
| PAID ✓ | `#DCFCE7` | `#14532D` |
| ↻ BIWEEKLY | `#EEF2FF` | `#3730A3` |
| ↻ WEEKLY | `#F5F3FF` | `#5B21B6` |
| NEW | `#F0FDF4` | `#14532D` |
| ⚠ OVERDUE | `#FEF3C7` | `#78350F` |
| ⚠ <1HR GAP | `#FECDD3` | `#881337` |
| 📅 GOOGLE CAL | `#DCFCE7` | `#14532D` |
| VIP ★ | `#FCD34D` | `#78350F` |
| NEXT UP (light bg) | `var(--pink)` | white |
| NEXT UP (dark bg) | `rgba(255,255,255,.2)` | white |

---

### 7. View Toggle (Calendar / Finance)

```css
.view-toggle {
  display: flex;
  background: var(--plum-mid);   /* #2C0B1A — always dark plum */
  border-radius: 12px;
  padding: 3px;
  margin: 10px 14px 0;
}
.vtog-btn {
  flex: 1;
  padding: 8px 0;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 9px;
  border: none;
  font-family: var(--font-ui);
  color: rgba(255,255,255,.55);   /* inactive — always readable */
  background: transparent;
}
.vtog-btn.active {
  background: var(--pink);
  color: white;
}
```

**Rule:** NEVER use gradients on toggle buttons. Active = solid pink. Inactive = rgba white at 55% opacity minimum. This ensures readability on the dark plum background.

---

### 8. FAB (Floating Action Button)

```css
.fab {
  position: absolute;
  bottom: 56px;
  right: 14px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1A0A12, #E91E6A);
  border: 2px solid white;
  box-shadow: var(--shadow-fab);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  cursor: pointer;
}
```

Icon inside FAB: `+` (20×20px, white, stroke-width 2.5)

---

### 9. Supermom GO! Button

Appears on: Home (morning card), Calendar day view (next job), Agenda view (next job)

```css
.go-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: white;
  border: var(--border-card);
  border-radius: var(--r-input);
  padding: 11px 14px;
  width: 100%;
  cursor: pointer;
}
.go-btn .icon-square {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: var(--pink-tint);
  border: var(--border-card);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* In production: contains <img src="/supermom_go.png" /> */
}
.go-btn .label {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 500;
  color: var(--pink-mid);
}
.go-btn .sublabel {
  font-size: 10.5px;
  color: var(--ink-muted);
  margin-top: 1px;
}
```

---

### 10. Bottom Navigation

4 items: Home · Calendar · Clients · Finance

```css
.bottom-nav {
  margin-top: auto;
  background: white;
  border-top: 1.5px solid var(--pink-border);
  padding: 8px 8px 16px;   /* 16px bottom = safe area */
  display: flex;
  justify-content: space-around;
  flex-shrink: 0;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: var(--ink-muted);
  font-size: 9px;
  font-weight: 600;
  flex: 1;
  padding: 4px 6px;
}
.nav-item.active { color: var(--pink); }
.nav-item .dot {
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--pink);
  opacity: 0;
  margin-top: 1px;
}
.nav-item.active .dot { opacity: 1; }
```

**Rule:** Always exactly 4 nav items. The AI assistant is a floating FAB — NOT a nav item. Never add a 5th item.

---

### 11. Client Profile Hero

```css
.profile-hero {
  background: var(--grad-hero);
  border-bottom: var(--border-hero);
  padding: 14px 18px 18px;
  color: white;
}
/* Avatar tile */
.profile-avatar {
  width: 56px; height: 56px;
  border-radius: 16px;
  background: var(--grad-action);
  box-shadow: 0 6px 16px rgba(233,30,106,.4);
  border: 2px solid rgba(255,255,255,.15);
}
/* Stats row (3 columns) */
.profile-stat {
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 11px;
  padding: 9px 6px;
  text-align: center;
}
```

**AI "What I know" context card** on profile: use WHITE background (not dark hero), `var(--border-card)`. This deliberately differentiates from the dark hero above it.

---

### 12. Bottom Sheet (New Job Flow)

```css
.bottom-sheet {
  background: var(--pink-pale);
  border-radius: 24px 24px 0 0;
  margin-top: auto;
  box-shadow: 0 -10px 40px rgba(0,0,0,.38);
}
.sheet-handle {
  width: 40px; height: 4px;
  background: var(--pink-border);
  border-radius: 4px;
  margin: 8px auto 0;
}
/* Step progress dots */
.step-dot {
  flex: 1; height: 3px;
  border-radius: 2px;
  background: var(--pink-border);
}
.step-dot.active { background: var(--pink); }
.step-dot.done   { background: var(--green); }
```

Review card in Step 3 uses `--grad-hero` + `--border-hero` — same treatment as all dark hero sections.

---

## Screen Inventory

### Home — 3 states of the Today Card

**Morning state** (before job start):
- Next job title, time range, drive time, address
- Prep notes from AI context
- Supermom GO! button (triggers navigation + geofence watch + mileage tracking)
- Geofence hint: "📍 Auto-timer ON · Starts when you arrive"

**Active job state** (geofence triggered):
- Dark card treatment
- Large running timer display
- "Auto-started on arrival" label
- Voice note + Photo + Done buttons

**Post-job state**:
- Job name, duration, amount with UNPAID badge
- Cash / e-Transfer pill toggle
- Log Payment button
- AI card: offer to draft thank-you + receipt text

Below Today Card (all states):
- 7-day week strip (today highlighted dark, job dots)
- AI suggestion card

### Calendar

- Header: month/year + Google Cal "Synced" green pill
- Toggle: Day / Week / Agenda
- Conflict banner (amber) if any jobs within 1hr of each other
- **Day view:** timeline, coloured job blocks, empty slots tap to book, GO button on next job
- **Week view:** 7-column grid, colour-coded cells (pink=unpaid, green=paid, amber=conflict)
- **Agenda view:** date headers, job cards with full badge set, GO button on next job

Job card colours:
- `var(--grad-action)` → active/next/unpaid
- `#F0FFF5` + green border → paid
- `#FFFBEB` + amber border → conflict warning

### Clients

List view:
- Search + filter chips (All / Owes $ / VIP / Overdue / Leads)
- Client rows: coloured avatar, name, VIP star, amount, last job info, tags

Profile view (dark plum hero — differentiates from pink banner):
- Hero: avatar + name + VIP/recurrence tags + 3-stat row
- Action buttons: Book Job (pink) + Message (white)
- AI "What I know" card (white bg — intentionally light to contrast hero)
- Contact: tap-to-call, tap-to-navigate, email
- Upcoming jobs, recent history, activity timeline

### Finance

- Dark hero: "This Week" + large $ amount + sub-label + trend pill + 5-week mini bar chart
- Period toggle: Week / Month / Year / All
- 2×2 grid: Collected (green), Outstanding (pink + nudge CTA), Expenses, Hours/avg rate
- AI insight: outstanding invoices, draft nudge texts
- Tax ready: YTD income, deductibles, mileage (auto-tracked), est. taxable, CSV export
- Recent activity: income (green), expenses (amber), pending (pink)

### New Job Flow (3-step bottom sheet)

**Step 1 — Who:**
- Recent client horizontal scroll
- Selected client dark plum banner
- Pre-fill toggle: ON by default for existing clients, shows what will be copied

**Step 2 — What & When:**
- Service grid (★ USUAL badge on last-used service)
- Date + time pickers
- Duration stepper + AI estimate card: "X hrs based on last N visits"
- Recurrence toggle (pre-set from client history)

**Step 3 — Review:**
- Dark hero summary: name, time range, price, duration, recurrence, drive time
- Conflict warning if <1hr gap (amber, non-blocking)
- Pre-flight checklist: GCal sync ✓, auto-timer ✓, mileage ✓, confirmation text toggle
- 🦸‍♀️ Book it! (Fraunces font, dark plum + pink border)

---

## UX Logic

### Auto-timer
- Triggered by tapping Supermom GO!
- Start: The operator arrives within ~150m of job address
- Stop: The operator moves 250m+ away for 3+ consecutive minutes
- NO manual start button — geofence handles everything

### Auto-mileage
- Starts automatically when GO! is tapped
- Tracks drive to job + drive away from job
- Logged against the job for tax tracking
- Displayed in Finance > Tax Ready as total km

### Conflict warning
- Fires when any two jobs are within 1 hour of each other
- Amber banner in Day/Week/Agenda views
- Amber border + `⚠ <1HR GAP` badge on conflicting job cards
- Also appears in New Job Step 3 review
- Non-blocking — the operator can proceed anyway

### Google Calendar sync
- Every job created → GCal event (title: service + client, location: address, description: notes + link)
- Every job edited → GCal event updated
- Every job cancelled → GCal event deleted
- Green "Synced" pill in Calendar header
- `📅 Google Cal` badge on all synced job cards

### Pre-fill on rebook
- When booking for an existing client: service, duration, price, recurrence, prep notes all pre-loaded
- Toggle shown ON by default with summary of what's being copied
- The operator can flip it off
- New clients: blank form

---

## Rules — DO

- Every dark hero section has `border-bottom: var(--border-hero)` (3px pink)
- All section labels: 10px, 700, uppercase, `--ink-mid`, 0.7px letter-spacing
- All AI card labels: `#FF78B0`, 9.5px, 700, 1.1px spacing, uppercase, `✦` prefix
- All cards: `1.5px solid #FFD6E8` border, `16px` border-radius
- FAB always: `bottom: 56px`, `right: 14px`
- View toggles always on dark plum background
- Dollar amounts always: Fraunces, tabular-nums
- Logo banner always: identical on every screen

## Rules — DON'T

- Never use gradients on toggle buttons (kills readability)
- Never add a 5th bottom nav item
- Never use Inter/system fonts for names, amounts, or hero display text
- Never show a pink section directly touching the pink banner (use dark hero in between)
- Never show a Start Timer button
- Never hard-delete records (soft delete only, `is_deleted = true`)
- Never use system timezone (`America/Toronto` always)
- Never use purple gradients, Space Grotesk, or generic AI aesthetics

---

*Design System v1.1 (Updated by Gemini CLI) · April 2026 · Supermom for Hire*
