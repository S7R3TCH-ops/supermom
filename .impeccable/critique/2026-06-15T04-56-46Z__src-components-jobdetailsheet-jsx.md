---
target: src/components/sheets/JobDetailSheet.jsx
total_score: 24
p0_count: 0
p1_count: 3
p2_count: 2
timestamp: 2026-06-15T04-56-46Z
slug: src-components-jobdetailsheet-jsx
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Loading is a plain text div, no skeleton; invoice/payment fetch has no indication |
| 2 | Match System / Real World | 3 | "Mission Vitals", "Command Brief" land well; "Great Scott!" / "1.21 Gigawatts!" don't |
| 3 | User Control and Freedom | 3 | Good: swipe-dismiss, in-app confirms. Gap: no undo post-delete, window.confirm() can't be dismissed with hardware back on Android |
| 4 | Consistency and Standards | 2 | window.confirm() breaks in-app confirm pattern; InfoCard 1px border vs 1.5px spec; section label pink instead of ink-mid |
| 5 | Error Prevention | 3 | Two-tap confirms on destructive actions; cancel requires reason. No visible field constraints in EditMode |
| 6 | Recognition Rather Than Recall | 3 | Actions visible and labeled; team member picker shows skills inline |
| 7 | Flexibility and Efficiency | 2 | No shortcut paths or smart grouping in EditMode |
| 8 | Aesthetic and Minimalist Design | 2 | EditMode is a flat 10+ field scroll with no sections; admin controls add visual weight |
| 9 | Error Recovery | 2 | mutErr shows raw error string; alert(err.message) in photo upload breaks toast pattern |
| 10 | Help and Documentation | 1 | No tooltips; Edit Job warning emoji unexplained; window.confirm() copy is the only help text |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

### Anti-Patterns Verdict

**LLM assessment:** No AI slop tells. The dark hero, prep note card, Fraunces for names/amounts, pink-on-dark vocabulary — cohesive and on-brand. Issues are consistency gaps, not aesthetic failures.

**Deterministic scan:** One finding — layout-transition at line 686. The padding-bottom transition on EditMode scroll container animates a layout property, causing reflow/jank. Real issue, not false positive.

### Overall Impression

The component has earned its design language. The single biggest opportunity is EditMode: a flat 10+ field scroll with no grouping asks Sandra to mentally organize everything herself. One structural pass to group fields into 2-3 named sections would cut cognitive load significantly.

### What's Working

**1. ReadMode hero.** Client name in Fraunces, tappable with dotted underline. Service name in correct hero label position (#FF78B0). This is the design system fully expressed.

**2. PrepNoteCard.** The ✦ Command Brief treatment, LISTEN/STOP toggle — delivers "mission control" personality without forcing it. Sits exactly where a user needs it.

**3. Destructive action safety.** Two-tap confirm for delete/mark-unpaid, required reason for cancel, invoice warning before edit. Each escalates appropriately.

### Priority Issues

**[P1] outline: none on every form input removes focus rings**
- Why it matters: WCAG 2.4.7 failure. Keyboard/accessibility users can't see focus throughout EditMode.
- Fix: Remove outline: 'none' from iStyle(). Add :focus-visible { outline: 2px solid var(--pink); outline-offset: 2px; }
- Suggested command: $impeccable audit

**[P1] window.confirm() for future-job warning on Complete and Paid**
- Why it matters: Native dialogs render outside the app's visual language. "Great Scott!" / "1.21 Gigawatts!" are unintelligible to Sandra. Breaks the in-app confirm pattern used everywhere else in this same component.
- Fix: Replace both window.confirm() calls with the in-app confirm pattern (pink-tinted box, labeled buttons). Replace Back to the Future copy with plain English: "This job is scheduled for [date] — mark it complete anyway?"
- Suggested command: $impeccable harden

**[P1] EditMode is a flat 10+ field scroll with no visual grouping**
- Why it matters: Date, Time, Service, Pricing, Amount, Hours, Additional Costs, Recurrence, Notes, Team, Pay, HST — 12 concepts in a flat list. Violates cognitive load chunking and grouping checklist items.
- Fix: Group into three sections with Fraunces section labels: "When & What" (Date, Time, Service, Pricing, Amount, Hours), "Extras" (Additional Costs, Recurrence, Notes), "Team" (Team Member, Pay, HST).
- Suggested command: $impeccable layout

**[P2] 32×32px close button below 44×44px minimum tap target**
- Why it matters: Sandra uses this one-handed. A 32px circle causes frequent tap misses.
- Fix: Add padding: 6px to the button so tap target is 44px while visual circle stays 32px.
- Suggested command: $impeccable audit

**[P2] transition: padding-bottom on EditMode scroll container (confirmed by detector)**
- Why it matters: Animating padding-bottom triggers full layout recalculation every frame — visible jank on keyboard appear/disappear.
- Fix: Replace with a conditional spacer div inside the scroll container, or use env(keyboard-inset-height) for native keyboard inset.
- Suggested command: $impeccable optimize

### Persona Red Flags

**Sandra (non-technical, one-handed, won't report bugs)**
- "Great Scott!" is unintelligible — may tap Cancel thinking it's an error, abandoning flow silently.
- 32px close button hard to hit when sheet first slides up.
- Edit form: no section context, she can't tell where she is in the form when scrolling quickly.

**Casey (Distracted Mobile User)**
- No autosave in EditMode — interrupted users lose changes.
- Save button at the very bottom of long scroll; tapping outside instead closes without saving (data-loss path she won't report).
- MediaCard's programmatic fileInput.click() may not trigger reliably on iOS Safari.

**Sam (Accessibility-Dependent)**
- outline: none on all inputs — tab focus invisible throughout EditMode. Most critical a11y failure.
- Close button (× SVG, no aria-label) announced as unlabeled button by VoiceOver.
- Hidden file input has no aria-label.

### Minor Observations

- fontWeight: 800 in FinancialMathBreakdown — Inter/Fraunces only loaded up to 700; browser synthesizes 800, looks slightly off.
- STATUS_COLORS uses #3B82F6 (Tailwind blue) for Scheduled — not in design system palette.
- SeriesPicker fontSize: 16 for prompt — only element at this size, inconsistent.
- Section label "Mission Vitals" uses T.pink instead of ink-mid per design system spec.
- InfoCard uses 1px border vs design system 1.5px.
- MediaCard inlined on single line — functionally correct but unmaintainable; alert() for errors breaks toast pattern.
- mutErr renders raw Supabase error strings to the operator.

### Questions to Consider

- "Does Edit need to live inside the same sheet, or would a dedicated Edit Job sheet give more room to design the edit experience properly?"
- "Should a condensed prep brief also appear in EditMode at the top for context?"
- "The footer button order is Complete → Paid → Edit → Cancel. Does this match actual frequency of use?"
