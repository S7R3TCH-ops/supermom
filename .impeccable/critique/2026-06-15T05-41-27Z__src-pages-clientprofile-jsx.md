---
target: src/pages/ClientProfile.jsx
total_score: 24
p0_count: 0
p1_count: 4
timestamp: 2026-06-15T05-41-27Z
slug: src-pages-clientprofile-jsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Text-only loading state; no skeleton; raw error.message exposed to user |
| 2 | Match System / Real World | 3 | "Prefs / Comms" field labels are abbreviated jargon; "See my future" button is cryptic |
| 3 | User Control and Freedom | 2 | Back button navigates to `/` (Home) not `/clients`; "View all jobs" is dead UI |
| 4 | Consistency and Standards | 3 | "Scheduled" badge uses off-system blue; Book Job button uses `#E91E6A` not `T.pink` |
| 5 | Error Prevention | 3 | Archive/delete have two-step confirm; no guard for null contact fields rendering `mailto:null` |
| 6 | Recognition Rather Than Recall | 3 | Edit button is icon-only with no visible label; "See my future" intent unclear |
| 7 | Flexibility and Efficiency | 2 | No shortcuts; no quick-action path for most-common task (log payment from profile) |
| 8 | Aesthetic and Minimalist Design | 3 | 5 AI fields always visible even when all empty adds noise in default state |
| 9 | Error Recovery | 2 | Raw `error.message` shown on load failure; no guidance on what went wrong or what to do |
| 10 | Help and Documentation | 1 | No tooltips, no hints on any fields; "See my future" has zero explanation |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

---

## Anti-Patterns Verdict

**LLM assessment**: No AI slop detected. The page follows the established design system faithfully: dark hero with radial glow, avatar tile, 3-stat row, AI card on white background for contrast, section labels, badge vocabulary. The "Client Profile" hero label is an intentional design-system usage. Layout composition avoids identical card grids and ornamental gradients. This reads as hand-tuned, not generated.

**Deterministic scan**: Clean. `detect.mjs` returned zero findings. No banned patterns (gradient text, glassmorphism, eyebrows, side-stripe borders, etc.) detected.

**Visual overlays**: Not available in this session. Browser injection skipped; fallback was source-only analysis.

---

## Overall Impression

The visual design is solid and on-brand — the hero section, stat tiles, and AI card are all well-executed. The main problems are UX and accessibility correctness: back button routes to the wrong screen, tap targets on the two hero icon-buttons are 14px below minimum, click-only job rows are not keyboard-accessible, and the same `outline: none` violation patched in JobDetailSheet (v0.12.50) was left in the AI card textareas. The single biggest opportunity is the non-functional "View all N jobs" button — it is dead UI that promises something and delivers nothing.

---

## What's Working

**1. Hero layout hierarchy**: Avatar tile, name + tags, stat row, and action buttons stacked in the right order for mobile scanning — most important thing (who is this?) at top, most common action (Book Job) within thumb reach at bottom. Solid execution of the DESIGN.md spec.

**2. Admin danger zone**: The two-step confirm pattern for both Archive and Hard Delete is right for irreversible operations. Progressive disclosure (collapsed by default, reveal, then confirm) adds appropriate friction without a modal.

**3. AI card contrast decision**: Placing the "What I know" card on a white/card background immediately below the dark hero creates the right visual separation. DESIGN.md calls this out explicitly; the implementation follows it.

---

## Priority Issues

**[P1] Back button navigates to `/` (Home) instead of `/clients`**
- **Why it matters**: When Sandra browses clients, taps a profile, then taps back, she lands on the Home screen instead of the client list. She has to re-navigate to Clients every time. On a daily workflow involving several client reviews, this compounds fast — and Sandra won't report it, she will just stop using the profile view.
- **Fix**: Change `onClick={() => navigate('/')}` to `onClick={() => navigate('/clients')}` (or `navigate(-1)` if history is reliable). DESIGN.md rule: sub-routes use `navigate(-1)`.
- **Suggested command**: `$impeccable polish`

**[P1] Back and Edit icon-buttons are 30x30px — below the 44x44px tap target minimum**
- **Why it matters**: Both hero icon-buttons are `width: 30, height: 30` with no padding expansion. DESIGN.md minimum is 44x44px. These are the smallest targets on the screen and sit in the top corners — thumb-unfriendly positions requiring precision taps on Sandra's iPhone.
- **Fix**: Add `padding: 7px` to each button (making the hit area 44x44px), or increase `width/height` to 44 and set `borderRadius: 22px`.
- **Suggested command**: `$impeccable polish`

**[P1] `outline: 'none'` on AI card textareas removes focus ring (WCAG violation)**
- **Why it matters**: Line 363 sets `outline: 'none'` on the edit textareas. This was the exact issue fixed in JobDetailSheet (v0.12.50). A keyboard or switch-access user editing intel fields gets no visible focus indicator. WCAG AA requires visible focus.
- **Fix**: Remove `outline: 'none'` from the textarea style. Add `:focus { outline: 2px solid var(--pink); outline-offset: 1px; }` via CSS class or inline focus handler.
- **Suggested command**: `$impeccable audit`

**[P1] Upcoming/history job rows are `<div onClick>` — not keyboard or screen reader accessible**
- **Why it matters**: Both job list sections use `<div onClick={() => openJob(j.id)}>`. These are not focusable, do not respond to Enter/Space, and are invisible to screen readers as interactive elements. Same class of issue fixed in the v0.12.50 a11y pass.
- **Fix**: Replace outer `<div>` with `<button>` (reset styles: `background: none; text-align: left; width: 100%; cursor: pointer`) or add `role="button" tabIndex={0} onKeyDown`.
- **Suggested command**: `$impeccable audit`

**[P2] "View all N jobs" button is non-functional dead UI**
- **Why it matters**: The button exists, has text, has a hover cursor, but does nothing (no onClick handler). A user who wants to see job 6+ hits a wall. This is worse than no button — it looks like a broken feature.
- **Fix**: Implement navigation to a filtered jobs view for this client, or open a sheet showing full history. If neither is ready, remove the button until it works.
- **Suggested command**: `$impeccable harden`

**[P2] Raw `error.message` shown on load failure — exposes Supabase errors to users**
- **Why it matters**: Line 132 renders `{error.message}` directly. If Supabase returns "JWT expired" or "relation does not exist", Sandra sees that. The invoice fix in v0.12.46 solved this for invoices; it was missed here.
- **Fix**: Replace `{error.message}` with "Couldn't load this client. Check your connection and try again." Log `error.message` to console only.
- **Suggested command**: `$impeccable harden`

---

## Persona Red Flags

**Sandra (Primary Operator, Casey archetype)**: Uses the app one-handed between jobs on iPhone. Red flags:
- Back button goes to Home, not the client list. After checking a profile she has to re-navigate through the bottom nav — 2 extra taps every time.
- Back and edit buttons are 30px targets in the top corners — furthest from her thumb, hardest to hit accurately.
- The "What I know" card always shows 5 empty rows ("None" x 5) for new clients. That is the first thing she sees after the hero — noise until AI context is populated.
- "See my future" on the AI card: no explanation of what it does. No tooltip, no description.

**Sam (Accessibility-Dependent User)**: Red flags:
- Both icon-buttons in hero have `aria-label` (good) but 30x30px hit area.
- Textarea `outline: none` — no visible focus ring in edit mode.
- Job rows are `<div>` elements — not keyboard-reachable, not announced as interactive by VoiceOver.
- Contact links are proper `<a>` tags — correct.

**Riley (Stress Tester)**: Red flags:
- If `client.phone` is null or empty, `href="tel:"` renders a broken link. Same for `client.email` — `mailto:` with no address. No guard against null contact fields.
- History shows max 5 with a dead "View all" button. Unclear what the data boundary is or whether job 6 exists.
- Starting to edit intel fields then tapping the browser back button: unsaved edits disappear with no warning.

---

## Minor Observations

- **"Scheduled" badge** (line 483): uses `#EFF6FF / #1D4ED8` blue — not in the badge vocabulary in DESIGN.md. Use existing badge tokens or define a new entry in the design system.
- **Book Job button color** (line 271): `background: '#E91E6A'` (deep rose) rather than `T.pink` or `var(--pink)`. Subtle inconsistency with every other primary action button.
- **Light mode hero border-bottom** (line 148): `borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none'`. DESIGN.md says never skip the 3px border-bottom. If light mode `T.hero` is not the dark gradient, the border is still needed to separate it from the pink logo banner.
- **Date tile day-of-week text** (lines 468, 517): `fontSize: 8` — 8px text is below legible threshold on mobile. Bump to at least 9px.
- **AI card field labels** ("Prefs", "Comms"): Sandra's own notes fields labeled with developer shorthand. "Preferences" and "Communication style" would be clearer.
- **"See my future" button**: Evocative but zero context. A one-line description ("Generate AI insights from job history") would remove the mystery.
- **Loading state**: Plain centered text "Loading client..." The product register calls for skeleton screens, not text in the middle of content.

---

## Questions to Consider

- "View all jobs" is dead. Is the intended destination a filtered jobs list, a modal, or an extended section on this page? Answering this determines whether it is a two-line fix or a new feature.
- Should the AI card's 5 fields collapse to a single "Add notes +" affordance when all are empty? The empty five-row state is noisier than useful for new clients.
- Is there ever a reason Sandra needs the full job history from the profile, or is "recent 5" always enough? If 5 is right, remove the "View all" button. If not, ship the navigation.
