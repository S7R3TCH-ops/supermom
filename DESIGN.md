---
name: Supermom for Hire
description: Mobile-first CRM & operations tool for solo personal-services operators
colors:
  # Primary brand (Sandra's official palette)
  pink: "#FC4693"
  pink-light: "#FFA8CC"
  pink-dark: "#C4006B"
  deep-rose: "#B5004E"
  pink-tint: "#FFF0F7"
  pink-border: "#FFD9EC"
  pink-label: "#FC4693"
  # Dark panel (shared across both themes — never changes)
  plum-dark: "#1C1C1E"
  plum-mid: "#2C2C2E"
  # Light theme surfaces
  bg: "#FFEFF4"
  surface: "#FFF5F8"
  card: "#FFFFFF"
  # Dark theme surfaces
  dark-bg: "#0A0A0A"
  dark-surface: "#1C1C1E"
  dark-card: "#2C2C2E"
  dark-pink: "#FF70A6"
  # Ink / text (light theme — neutral, not warm-brown)
  ink: "#2D2D2D"
  ink-sub: "#606060"
  ink-muted: "#8A8A8A"
  # Status
  green: "#16A34A"
  green-light: "#DCFCE7"
  green-border: "#86EFAC"
  green-text: "#14532D"
  amber: "#F59E0B"
  amber-light: "#FEF3C7"
  amber-text: "#78350F"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "28px"
    fontWeight: 500
    letterSpacing: "-0.6px"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "21px"
    fontWeight: 500
    letterSpacing: "-0.3px"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "14px"
    fontWeight: 500
    letterSpacing: "-0.2px"
  amount-large:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "44px"
    fontWeight: 500
    letterSpacing: "-2px"
  amount-card:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "22px"
    fontWeight: 500
    letterSpacing: "-0.5px"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.7px"
  badge:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 700
    letterSpacing: "0.4px"
  ai-label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "9.5px"
    fontWeight: 700
    letterSpacing: "1.1px"
rounded:
  badge: "5px"
  input: "12px"
  card: "16px"
  sheet: "24px"
  pill: "100px"
spacing:
  screen-h: "14px"
  card-pad: "12px 14px"
  hero-pad: "16px 18px"
  sheet-body: "6px 18px 14px"
  tap-target: "44px"
  section-gap: "14px"
components:
  button-primary:
    backgroundColor: "{colors.pink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.input}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.pink-dark}"
    textColor: "#FFFFFF"
    rounded: "{rounded.input}"
    padding: "13px 20px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "11px 16px"
  button-destructive:
    backgroundColor: "{colors.pink-dark}"
    textColor: "#FFFFFF"
    rounded: "{rounded.input}"
    padding: "13px 20px"
  input-default:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "12px 14px"
  card-standard:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  card-hero:
    backgroundColor: "{colors.plum-dark}"
    textColor: "#FFFFFF"
    rounded: "0px"
    padding: "{spacing.hero-pad}"
  fab:
    backgroundColor: "{colors.plum-dark}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    size: "50px"
  chip-filter:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-sub}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  chip-filter-active:
    backgroundColor: "{colors.pink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
---

# Design System: Supermom for Hire

## 1. Overview

**Creative North Star: "The Solo Superhero Ops Center"**

This is not a SaaS dashboard. It's a mission-control interface designed to make one person feel like they have ten people behind them. Every screen is built for one-handed use between client calls — dark charcoal hero panels that feel premium and purposeful, warm cream surfaces for working content, and a shocking pink heart at every interaction point. The interface carries confidence not through visual noise, but through craft: precision spacing, disciplined weight hierarchy, and zero unnecessary decisions left to the operator.

The app runs in two modes: **warm** (default, daytime) and **dark** (premium night atmosphere). Both share the same charcoal mission panels (`#1C1C1E`/`#2C2C2E`) — the dark hero sections never adapt between themes. In warm mode, the brand pink is the deeper, punchier `#E91E6A`; in dark mode it softens to `#FF70A6`. The mode toggle lives in the logo bar as a premium utility. The dual-theme system is a first-class design choice, not an afterthought.

This design explicitly rejects: the "vibe-coded in 24 hours" AI-app look (inconsistent spacing, generic component defaults, mismatched type scales); toy-like cartoon superhero treatments (cape badges, exclamation-heavy copy, literal superhero iconography); and cold corporate SaaS (gray hero-metric dashboards, enterprise chrome, B2B blue palettes). Every screen should feel like it was built by someone who knows exactly what Sandra needs — and delivered it finished.

**Key Characteristics:**
- Dark charcoal hero panels anchor every screen; warm cream surfaces float below
- One brand color (pink) used with discipline: CTAs, focus rings, 3px hero bottom border, active nav
- Two typefaces with a clear job division: Fraunces owns all names and numbers; Inter owns all UI text
- Dollar amounts always Fraunces with tabular-nums — money looks like money
- AI-facing elements get a distinct label treatment: `✦` prefix, `#FF78B0` pink, uppercase — visually distinct from all other labels
- 44×44px minimum tap targets and pink focus rings (`.sm-input` class) enforced everywhere

---

## 2. Colors: The Papaya Palette

A disciplined dual-theme system anchored by one brand color. The warm palette is built around soft rose cream and warm cocoa ink for comfortable daylight use. The dark palette inverts to near-black with softened pinks for night. Both palettes share the charcoal mission panels, which never change.

### Primary
- **Punchy Pink** (`#E91E6A` warm / `#FF70A6` dark): The only action color in the system. CTAs, active nav indicator dot, focus borders (`.sm-input`), the 3px hero bottom border, active filter chips, step progress bar. Never used decoratively.
- **Rose Glow** (`#FF94BC`): Gradient start, avatar backgrounds, soft tints. Supports Punchy Pink without competing.
- **Mission Spotlight** (`#B01550` / `#B5004E`): Button hover state, invoice heading color, destructive confirmation states. Next Up card spotlight on Home hero uses `#B5004E` (the `DEEP_ROSE` constant).
- **Pink Label** (`#FF78B0`): Reserved exclusively for AI card labels and hero-section uppercase callout text. Always on dark charcoal backgrounds.

### Secondary
- **Charcoal Dark** (`#1C1C1E`): All dark hero sections, FAB background, AI card background, view toggle container. Never changes between themes.
- **Charcoal Mid** (`#2C2C2E`): View toggle bg, hero gradient end, dark card bg in dark mode.

### Neutral
- **Soft Rose Cream** (`#FFF0F3` warm / `#0A0A0A` dark): App body background.
- **Soft Sand** (`#FCF5EF` warm / `#1C1C1E` dark): Secondary surface.
- **Card White** (`#FFFFFF` warm / `#2C2C2E` dark): Card backgrounds.
- **Soft Pink Border** (`#FCE8EF` warm / `rgba(255,112,166,0.2)` dark): ALL card and input borders throughout the app.
- **Warm Cocoa** (`#4E342E` warm / `#FFFFFF` dark): Primary text.
- **Soft Brown** (`#795548` warm / `rgba(255,255,255,0.65)` dark): Secondary text, meta labels.
- **Muted Clay** (`#836459` warm / `rgba(255,255,255,0.55)` dark): Placeholders, tertiary text. Achieves ~4.9:1 on `#FFF0F3` (WCAG AA pass).
- **Pink Tint** (`#FFF0F7`): Selected state backgrounds, Next Up card fill, active chip state in warm mode.

### Status
- **Paid Green** (`#16A34A`): Paid status, GCal synced, positive values. Background `#DCFCE7`, border `#86EFAC`, text `#14532D`.
- **Conflict Amber** (`#F59E0B`): Schedule conflicts, overdue. Background `#FEF3C7`, text `#78350F`.

### Named Rules
**The One Pink Rule.** Pink is a single-color system: `#E91E6A` in warm mode, `#FF70A6` in dark mode. No competing accents. Pink means action, active, or AI. Everything else is neutral.

**The Hero Seal Rule.** Every dark hero section ends with `border-bottom: 3px solid #E91E6A`. This is the visual brand signature — the pink line that seals the mission panel from the content below. Never skip it. Never render a pink logo banner directly touching a pink or pink-adjacent section.

---

## 3. Typography

**Display Font:** Fraunces (variable optical-size 9–144, weights 400–600, with italic axis) — Google Fonts.
**Body Font:** Inter (weights 400–700) — Google Fonts.

```
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');
```

**Character:** Fraunces is an optical-size variable serif with editorial confidence — it commands attention on names and amounts without feeling antiquated. Inter is a geometric humanist sans that does invisible work: legible at 9px, clean at 13px, never precious. The pairing creates a clear register division: Fraunces signals value and identity; Inter signals function and information.

### Hierarchy

| Role | Font | Size | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| Display / greeting | Fraunces | 28px | 500 | -0.6px | Morning greeting, operator name |
| Hero job title | Fraunces | 21px | 500 | -0.3px | Next job headline in dark hero |
| Client name (profile) | Fraunces | 22px | 500 | -0.4px | Profile hero, white on dark |
| Amount (large) | Fraunces | 44px | 500 | -2px | Finance hero weekly/monthly total |
| Amount (card) | Fraunces | 22px | 500 | -0.5px | Job card totals, payment amounts |
| Amount (inline) | Fraunces | 13px | 500 | 0 | Inline monetary references |
| Section title | Fraunces | 14px | 500 | -0.2px | Card section headings |
| Section label | Fraunces | 10px | 600 | 0.7px | List group headers — sentence case |
| AI card label | Inter | 9.5px | 700 | 1.1px | `✦ PREFERENCES` on dark AI cards |
| Badge / tag | Inter | 9px | 700 | 0.4px | Status badges — uppercase only |
| Body text | Inter | 12–13px | 500 | 0 | Card content, meta, body copy |
| Meta / sub-label | Inter | 10.5–11.5px | 500 | 0 | Timestamps, secondary info |
| Button (primary) | Inter | 13px | 700 | 0 | White on pink CTAs |
| Button (secondary) | Inter | 12px | 600 | 0 | Outline/ghost actions |

**Rule:** Every dollar amount uses `font-variant-numeric: tabular-nums` (`.tabular` class or inline `fontVariantNumeric: 'tabular-nums'`).

**Mobile input floor:** `font-size: 16px` on all `<input>`, `<select>`, `<textarea>` on ≤768px screens (enforced globally in `index.css`) to prevent iOS auto-zoom on focus.

### Named Rules
**The Fraunces / Inter Split.** Names, amounts, and hero display text: Fraunces only. Labels, buttons, body copy, meta: Inter only. Never mix within a single semantic unit.

**The Sentence-Case Rule.** All UI labels, buttons, section headers, and form labels use sentence case. ALL CAPS is reserved for exactly two contexts: (a) badge/tag text (UNPAID, VIP, PAID ✓), and (b) AI card label prefixes (`✦ PREFERENCES`). Every other label that was previously ALL CAPS was corrected in polish passes v0.12.52–v0.12.61.

---

## 4. Elevation

This system uses **tonal elevation** as its primary depth signal. The dark charcoal hero panels (`#1C1C1E`) sitting above the warm cream content is the most significant depth moment on every screen — no shadow required. Cards use a single soft pink-tinted shadow and 1.5px pink border to read as lifted tiles against the warm background.

Shadows appear in exactly two places: cards (ambient diffusion) and the FAB (purposeful "above everything" emphasis).

### Shadow Vocabulary
- **Card ambient** (`0 2px 12px rgba(233,30,106,.08)`): Standard cards at rest. Soft pink-tinted diffusion. Also expressed as `.card-shadow` class (`0 4px 12px rgba(255,112,166,.08)`).
- **FAB emphasis** (`0 8px 22px rgba(233,30,106,.4)`): The floating action button only. Much stronger — communicates elevated status above all content.
- **Bottom sheet lift** (`0 -10px 40px rgba(0,0,0,.38)`): Applied above the bottom sheet overlay.

### Named Rules
**The Two-Shadow Rule.** Cards and the FAB. That's the entire shadow vocabulary. No shadow on inputs, banners, the logo bar, badges, navigation, or any other surface.

**The Flat Hero Rule.** The dark hero panel's depth is conveyed by tonal contrast alone — the 3px pink `border-bottom` is the divider. No shadow on hero sections.

---

## 5. Components

### Buttons
Confident, rounded, no decoration. Primary pink fills communicate "do the thing." Secondary outlines communicate "I have a choice." All buttons carry `type="button"` unless they submit a form.

- **Shape:** 12px radius. Full-pill only for chips and FAB.
- **Primary** (`T.pink` bg, white text, 700 weight, 13px, `13px 20px` padding): Book, submit, confirm, log payment.
- **Primary hover:** `#B01550` bg.
- **Secondary** (`T.card` bg, `T.ink` text, `1.5px solid T.cardBorder`): Cancel, back, "not now."
- **Destructive** (`#B01550` bg, white text): Delete, void, reset. Requires in-app two-tap confirm before firing.
- **Ghost** (transparent, `T.inkSub` text): Tertiary actions in dense contexts.
- **Disabled** (`T.pinkTint` bg, `T.inkMuted` text): Tinted, not grayed.
- **Rule:** `type="button"` on every non-submit button. No exceptions.

### Focus Rings (`.sm-input`)
```css
.sm-input:focus {
  outline: none;
  border-color: var(--pink) !important;
}
```
Applied to all `<input>`, `<textarea>`, and `<select>`. Focus rings are never suppressed — the border turns pink instead of showing the default browser outline. WCAG AA required.

### Cards / Containers
Standard card: `background: T.card`, `border: 1.5px solid T.cardBorder`, `border-radius: 16px`, `padding: 12px 14px`, `margin-bottom: 7px`, `box-shadow: 0 2px 12px rgba(233,30,106,.08)`.

Semantic variants:

| Variant | Border | Background |
|---|---|---|
| Standard | `1.5px solid #FCE8EF` | `#FFFFFF` |
| VIP | `1.5px solid #FCD34D` | `linear-gradient(135deg, #FFFBEB, white)` |
| Paid | `1.5px solid #86EFAC` | `#F0FFF5` |
| Conflict | `1.5px solid #F59E0B` | `#FFFBEB` |
| Next Up | `1.5px solid T.pink` | `T.pinkTint` |
| Owing | `1.5px solid #F472B6` | white |

Dark hero section: `background: linear-gradient(145deg, #1C1C1E, #2C2C2E)`, `border-bottom: 3px solid #E91E6A`, radial pink glow `::before` pseudo-element.

AI card: always dark plum, same gradient + glow as dark hero. Never white, never adapts to theme.

### Inputs / Fields
- **Default:** `T.bg` background, `1.5px solid T.cardBorder` border, 12px radius, `12px 14px` padding, `font-size: 16px` (iOS zoom guard), `T.ink` color.
- **Focus:** border-color becomes `T.pink` via `.sm-input` class.
- **Placeholder:** `T.inkMuted` (WCAG AA verified on both theme backgrounds).
- **Error:** amber border + amber-tint background.

### Chips / Filter Pills
- **Shape:** `border-radius: 100px`
- **Default:** `T.card` bg, `T.inkSub` text, `1.5px solid T.cardBorder`
- **Active:** `T.pink` bg, white text
- **Count badge:** appended to chip label, `font-size: 9px`, weight 700, gray tint circle
- **Padding:** `5px 12px` (filter chips), `6px 10px` (action chips)

### Badges & Tags
```css
.badge {
  font-size: 9px; font-weight: 700;
  padding: 2px 7px; border-radius: 5px;
  letter-spacing: 0.4px; text-transform: uppercase;
}
```

| Badge | Background | Text |
|---|---|---|
| UNPAID | `#FFE0EC` | `#9B0D3A` |
| PAID ✓ | `#DCFCE7` | `#14532D` |
| ↻ BIWEEKLY | `#EEF2FF` | `#3730A3` |
| ↻ WEEKLY | `#F5F3FF` | `#5B21B6` |
| ⚠ OVERDUE | `#FEF3C7` | `#78350F` |
| ⚠ <1HR GAP | `#FECDD3` | `#881337` |
| 📅 GOOGLE CAL | `#DCFCE7` | `#14532D` |
| VIP ★ | `#FCD34D` | `#78350F` |
| NEXT UP | `T.pink` | `#FFFFFF` |

### View Toggle
Used on Calendar (Day/Week/Agenda) and Finance (Week/Month/Year/All).
- **Container:** `background: #2C2C2E` (always charcoal, never adapts to theme), `border-radius: 12px`, `padding: 3px`
- **Active button:** `background: T.pink`, white text, `border-radius: 9px`
- **Inactive button:** transparent bg, `rgba(255,255,255,.55)` text — never lower opacity

### Bottom Sheet
```css
.bottom-sheet { background: T.bg; border-radius: 24px 24px 0 0; box-shadow: 0 -10px 40px rgba(0,0,0,.38); }
.sheet-handle  { width: 40px; height: 4px; background: T.cardBorder; border-radius: 4px; margin: 8px auto 0; }
```
Body padding: `6px 18px 14px`. Keyboard spacer: simple `<div style={{ height: isKeyboardFocused ? 260 : 0 }} />` — no CSS transition.

### Step Progress (NewJobSheet)
3-segment flex bar. Each: `flex: 1`, `height: 3px`, `border-radius: 2px`. Colors: done = `var(--green)`, active = `T.pink`, future = `T.cardBorder`.

### FAB
```css
.fab {
  position: absolute; bottom: 56px; right: 14px;
  width: 50px; height: 50px; border-radius: 50%;
  background: linear-gradient(135deg, #1C1C1E, #E91E6A);
  border: 2px solid white;
  box-shadow: 0 8px 22px rgba(233,30,106,.4);
  z-index: 10;
}
```

### AI Assistant Card
Always `background: linear-gradient(145deg, #1C1C1E, #2C2C2E)`. Never white, never adapts to theme. Radial glow `::before`. Icon square: 28×28px, radius 9px, `background: linear-gradient(135deg, #FF94BC, #FF70A6)`.

AI label mandatory format: `✦ LABEL TEXT` — Inter, 9.5px, 700, 1.1px tracking, uppercase, color `#FF78B0`.

### Logo Banner
Route-aware. Background: `linear-gradient(110deg, #FF70A6, #E91E6A, #B01550)` (static, never adapts). Top-level routes: brand logo at 30px height. Sub-routes: `‹ Back` button. Right side: privacy toggle + 44×44px avatar button.

### Bottom Navigation
4 items only: Home · Calendar · Clients · Finance. `border-top: 1.5px solid T.navBorder`. Active: `T.pink` color + 4px dot. Inactive: `T.inkMuted`. Padding: `8px 8px 16px`.

### In-App Confirmation (Two-Tap Pattern)
No `window.confirm()` anywhere. Destructive actions: first tap reveals inline confirm UI (red-tinted card, Cancel + Confirm), second tap fires. Auto-resets after ~3s.

---

## 6. Do's and Don'ts

### Do:
- **Do** apply `border-bottom: 3px solid #E91E6A` to every dark hero section — this is the brand's visual signature.
- **Do** use Fraunces for all names, amounts, and hero display text; Inter for all labels, buttons, and body copy.
- **Do** apply `font-variant-numeric: tabular-nums` to every dollar amount.
- **Do** use `.sm-input` class (or equivalent pink focus border) on every form field. Focus rings are never suppressed.
- **Do** enforce 44×44px minimum tap targets on every interactive element.
- **Do** convert any `<div onClick>` to `<button type="button">` with a descriptive `aria-label`.
- **Do** use sentence case for all UI labels, section headers, and button text.
- **Do** use `America/Toronto` timezone in all date and time formatting — never system timezone.
- **Do** soft-delete only: `deleted_at = now()`. Never hard-delete jobs, clients, or workers.
- **Do** replace `window.confirm()` with the in-app two-tap confirm pattern for all destructive actions.
- **Do** trigger `hapticFeedback()` (from `src/lib/haptics.js`) on significant actions: book, complete, pay, submit.
- **Do** include the radial pink glow `::before` on every dark hero section and AI card.
- **Do** keep ALL CAPS exclusively for badge/tag text and AI card `✦ LABEL` prefixes.
- **Do** use the dual-theme system via `T = smTokens(mode)` — never hardcode colors that differ between themes.

### Don't:
- **Don't** ship a "vibe-coded" look: inconsistent spacing, mismatched type scales, generic default component styles. Every element should look considered.
- **Don't** use toy-like or cartoon superhero treatments — cape badges, exclamation-heavy copy, literal comic-book iconography.
- **Don't** build cold corporate SaaS: gray metric-hero tiles, B2B blue palette, enterprise chrome.
- **Don't** suppress focus rings. `outline: none` is only acceptable when paired with `.sm-input` pink border on focus.
- **Don't** use gradients on view toggle buttons. Active toggle = solid `T.pink` only.
- **Don't** render the pink logo banner directly touching a pink or pink-tinted section — dark hero goes in between.
- **Don't** add a 5th bottom navigation item. The AI assistant is a FAB, not a tab.
- **Don't** use `window.confirm()`. Two-tap in-app confirm only.
- **Don't** hard-delete records. Soft-delete only.
- **Don't** use purple gradients, purple-tinted blacks, glassmorphism, or neon accents. Dark panels are warm charcoal (`#1C1C1E`), never purple.
- **Don't** use `border-left` greater than 1px as a colored stripe accent. Use full borders, background tints, or leading icons.
- **Don't** use gradient text (`background-clip: text`). Pink is solid or gradient on a surface — never the text itself.
- **Don't** add a CSS `transition` to the keyboard spacer `<div>`. Instant height change only — transitions cause layout thrash on iOS.
- **Don't** use system timezone anywhere. `America/Toronto` everywhere, always.

---

*Design System v2.0 · Full regenerate from code, Jun 2026 · Supermom for Hire*
