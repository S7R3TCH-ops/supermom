---
target: Home screen (src/pages/Home.jsx)
total_score: 23
p0_count: 1
p1_count: 2
timestamp: 2026-06-08T18-30-56Z
slug: src-pages-home-jsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live timer/pulse/leave-by countdown are strong, but the global loading state is one bare string ("Initializing context...", line 531) and `locationLoading` text is buried inside a button label |
| 2 | Match System / Real World | 4 | "Leave in 12 min," "Up Next" translate Sandra's mental model well — the one mismatch is the "Mission/Command Brief" vocabulary layered on top of it |
| 3 | User Control and Freedom | 2 | `+30 MIN`/`+COST` commit instantly via `window.prompt` with no edit/confirm step; only the Owing accordion is collapsible/dismissible |
| 4 | Consistency and Standards | 1 | Three near-identical row-card layouts hand-rolled separately (Rest of Week, Next Week, Owing) instead of reusing `JobCard`/`UpcomingCard`; stripe-border widths/colors vary 3–6px across 5 places |
| 5 | Error Prevention | 2 | Adding a cost mid-job uses two stacked `window.prompt`s with only `isNaN` validation — a typo silently corrupts a financial record that flows into invoices |
| 6 | Recognition Rather Than Recall | 3 | Color/badge system reduces recall well, but 🦸 Sidekick / 🌟 Wingmom emoji-role mapping adds an arbitrary memorization tax |
| 7 | Flexibility and Efficiency | 3 | "Read Brief" TTS, GPS-based GO button, and traffic refresh are genuinely strong one-handed/mid-task accelerators |
| 8 | Aesthetic and Minimalist Design | 2 | Up to 7 stacked sections can render simultaneously; "Mission Active · Happening Now," pulse dot, and flying-icon launch directly contradict the "capable, not flashy" brand principle |
| 9 | Error Recovery | 1 | Raw `alert("Could not add time.")` / `alert("Could not add cost.")`; location/traffic fetch failures are silently swallowed with no user-facing explanation |
| 10 | Help and Documentation | 2 | Mostly self-explanatory by design (good) — except the invented "Command Brief / Mission Intel / Sidekick / Wingmom" vocabulary that Sandra has to learn just to read her own schedule |
| **Total** | | **23/40** | **Acceptable — significant improvements needed before the experience matches the brand promise** |

## Anti-Patterns Verdict

**Does this look AI-generated?** Not at first glance — there's real domain craft here (the `formatLeaveBy` translation layer, the `computeJobSubtotal`/`computeJobTotal` discipline carried into the UI). But scroll for 30 seconds and the "many sessions, no unifying pass" tell shows up: the same conceptual element (a job summary row) is hand-built four different ways with small drifts in padding, font size, and accent color. That's "polish-by-exhaustion," not "polish-by-system" — the AI-coding-session signature of inlining a new variant each time rather than parameterizing one component.

**LLM assessment**: The clearest tell is the **side-stripe border** repeated five times at three different widths (3px, 4px, 6px) and at least five different colors — explicitly the kind of micro-inconsistency the design skill calls an absolute ban. Close behind: a 17-value font-size spread on one screen (9 through 30px, with redundant near-duplicates like 10/10.5/11), and a gradient applied to nearly every hero-style element (radial glow, Next-Up card background, GO button ×2 states) — individually fine, collectively a "every important thing gets a gradient" reflex.

**Deterministic scan**: `detect.mjs` confirms this independently — **6 findings (exit code 2)**, all `warning` severity:
- 4× `side-tab` (side-stripe accent border): **lines 729, 955, 1088, 1135** in `Home.jsx` — these are the *exact same four lines* the LLM review flagged independently, before either assessment saw the other's output. That's a strong cross-validation signal, not noise.
- 1× `layout-transition`: line 1208, `transition: 'height 0.2s ease-out'` animating a layout property (`height`) on the keyboard-padding spacer — low-impact (tiny spacer div) but mechanically a real layout-thrash pattern.
- A scan of `src/pages` found the same 5 in `Home.jsx` plus 1 more `side-tab` in `Admin.jsx:430` and 1 more `layout-transition` in `Settings.jsx:348` — so this isn't unique to Home, it's a pattern across the app.

No false positives — every flagged line is a genuine colored `borderLeft` stripe layered on top of (or instead of) a full border, exactly as the rule describes; none are JSX-parsing artifacts.

**Additional source-level evidence** (mechanical, from Assessment B):
- 16 distinct inline `fontSize` values across 63 occurrences (`8, 8.5, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 17, 19, 21, 26, 30`) — no consistent scale
- 8 distinct `borderRadius` values (`4, 6, 8, 10, 12, 18, '50%', '0 0 12px 12px'`)
- 2 genuine "ghost-card" border+shadow combos (≥16px blur paired with a visible border): **line 618** (24px blur + 2px border) and **line 735** (28px dual-shadow + 2.5px border + 6px borderLeft, all stacked on the same Next-Up card — the single most over-decorated element on the screen)
- Zero gradient-on-text instances (clean on that specific ban)
- Color literals (e.g. `#FFD6E8`, `#1a0008`, `#8B0E3F`) scattered directly in `style={{}}` objects alongside theme-token references (`T.ink`, `T.pink`) in the same file — inconsistent token discipline within one component

**Visual overlays**: Not available this run — no browser-automation tool (Playwright/Browser) is exposed in this session, so the `[Human]` tab overlay flow could not run. This is a session-environment limitation, not a project issue; a future critique run with browser tooling available should add the visual layer. All findings above come from independent source review plus the deterministic scanner, which is itself a meaningful cross-check (the two methods landed on the *same four lines* without coordination).

## Overall Impression

The bones are good — the screen is built around a genuinely smart translation layer (`formatLeaveBy`, the mutually-exclusive active/next/empty branch, the subtotal-vs-total discipline) that reflects real understanding of Sandra's day and her business rules. But the execution shows the wear of being built incrementally across many sessions: the same UI idea (a job summary row, a hero card, an accent border) gets reinvented slightly differently each time it's needed, and the screen has accumulated more sections than a "glance between client calls" should require. The single biggest opportunity is **consolidation**: one parameterized row component instead of four, one collapsed "this week" view instead of two separate scrolling lists, and a tone pass that brings "Mission Active / Command Brief / Sidekick" in line with the "capable, not flashy" brand the team has already decided on (CLAUDE.md flags this as open work).

## What's Working

1. **`formatLeaveBy` + the "Up Next" strip** (lines 359–367, 651–698): turns a raw drive-time number into "Leave in 12 min" / "Leave by 2:45 PM" / "Leave NOW" with three-tier urgency coloring. This is the "make the hard parts invisible" principle executed perfectly — it replaces a calculation Sandra would do in her head with a sentence she reads in half a second.
2. **The mutually-exclusive active/next/empty branch** (lines 610–903): never shows two competing "what's happening now" cards at once. A lot of dashboards get this wrong; this one is disciplined about it.
3. **The Owing accordion** (lines 1037–1117): collapsed by default, color-escalates only after 48 hours, and only on the row — not the header count. It nudges without nagging, which is exactly the emotional register the brand wants. It's also the *only* section using progressive disclosure; ironically it's the template the rest of the screen should follow.

## Priority Issues

**[P0] `window.prompt`/`alert` used for financial data entry mid-job**
- **What**: Lines 514–527 use two stacked native `window.prompt()` dialogs (amount, then description) with only `isNaN` validation, and lines 510/525 fall back to bare `alert("Could not add time.")` / `alert("Could not add cost.")` on failure.
- **Why it matters**: This is triggered from the *active job card* — i.e., while Sandra is mid-job, likely one-handed, possibly in a client's home. A native prompt dismissed by an accidental tap, or a typo'd decimal that passes `isNaN`, silently writes a wrong number into `additional_costs_json` — a field that flows directly into the invoice the client receives. CLAUDE.md is explicit that `payments` is the only source of truth precisely because raw fields get out of sync; this flow bypasses every safeguard the rest of the app has built around money.
- **Fix**: Replace with the existing bottom-sheet pattern (the app already has `NewExpenseSheet`/`PostJobSheet` infrastructure and a house convention of `onFocus={e => e.target.select()}` on numeric inputs). A proper amount input with an explicit confirm step closes this gap with components that already exist.
- **Suggested command**: `$impeccable harden` (this is squarely an "errors, edge cases, production-readiness" fix on a money-handling path)

**[P1] The vertical stack can surface up to 7 sections at once, contradicting "make the hard parts invisible"**
- **What**: On a normal week, Sandra can see Active/Next-Up, Coming Up Today, Rest of This Week, Owing, Next Week Preview, and Done This Week — six to seven structurally distinct visual treatments in one scroll, with no caps on `restOfWeekJobs`/`nextWeekJobs` (a busy week could render 8–10 near-identical rows).
- **Why it matters**: This is the screen Sandra opens *between client calls*, with partial attention, one-handed. Design Principle #1 in PRODUCT.md is literally "make the hard parts invisible" — but right now she has to scroll through her entire week's operational state to confirm "what do I do next." The Owing accordion already proves the team knows how to do progressive disclosure well; it's just not applied consistently.
- **Fix**: Collapse "Rest of This Week" and "Coming Up Next Week" into a single tap-to-expand "This week at a glance" accordion mirroring the Owing pattern (defaulting closed except on days with nothing active). Move "Done This Week" — currently a low-opacity, zero-action afterthought at the bottom — to the Finance surface where it can actually be a peak-end "look what you got done" moment instead of dead weight on the daily hot path.
- **Suggested command**: `$impeccable distill` (strip to essence / reduce stacked complexity), then `$impeccable layout` for the resulting rhythm pass

**[P1] Side-stripe borders + duplicated row-card layouts — confirmed by both independent assessments at the identical four lines**
- **What**: `borderLeft` accent stripes at **lines 729 (6px), 955 (3px), 1088 (3px), 1135 (3px)** — three different widths, five different colors — layered on top of (or instead of) full borders, plus two "ghost-card" border+shadow stacks at **lines 618 and 735** (the latter combining a 2.5px border, a 6px borderLeft, and a dual 28px-blur shadow on a single card). These accompany three near-identical hand-rolled row layouts (Rest of Week: 948–1029, Next Week: 1129–1175, Owing: 1082–1112) that duplicate what `JobCard`/`UpcomingCard` already do.
- **Why it matters**: This is the textbook "looks built-in-pieces" tell — a reviewer (or Sandra, subconsciously) registers "why does every list look slightly different" even without being able to say why. It also means any future change (a new status state, a new badge) requires editing 5 places instead of 1, which is exactly how this drift compounds further. Worth noting this isn't unique to Home — the detector found the same `side-tab` pattern in `Admin.jsx:430`.
- **Fix**: Extend `JobCard` (or `UpcomingCard`) with a `variant` prop covering "rest-of-week"/"next-week"/"owing" instead of three bespoke blocks, and replace the `borderLeft` stripe accents with background-tint + icon/badge treatments consistent with the rest of the card system (per the design skill's explicit ban on side-stripe borders).
- **Suggested command**: `$impeccable distill` to consolidate the row variants, then `$impeccable layout` to unify spacing/border treatment across the result

**[P2] Superhero-language layer works against the "kick-ass Mary Poppins" brand the team already chose**
- **What**: "Command Brief" (549), "Mission Active · Happening Now" with a pulsing dot (612, 622), "Mission Intel" (647), "Sidekick 🦸 / Wingmom 🌟" (766, 1011), and a flying-icon launch animation on the GO button (857–861) — precisely the "literal superhero iconography/language" PRODUCT.md says to dial back ("reads as amateur, not aspirational").
- **Why it matters**: Sandra is a solo organizer/caregiver, not running a tactical operation — every time she opens her main work screen, ordinary tasks ("drive to a client's house") get framed as a military mission. CLAUDE.md's own "Next session priorities #0" already flagged this exact gap between PRODUCT.md's toned-down voice and DESIGN.md's still-superhero-heavy language — this critique confirms it's visible in the actual rendered screen, not just the docs.
- **Fix**: Rename "Command Brief" → "Today," "Mission Active" → "Happening now," drop or simplify the flying-icon launch animation, and replace 🦸/🌟 with neutral role labels. This is the exact refresh CLAUDE.md already scheduled for "when doing visual/UI work" — this critique is the trigger.
- **Suggested command**: `$impeccable clarify` (copy/labels) paired with `$impeccable quieter` (tone down the mission-control visual register)

**[P3] Borderline-contrast `inkMuted` text compounded by an `opacity: 0.82` wrapper**
- **What**: `inkMuted` (`#A1887F`) measures ~3.3:1 on white and ~3.0:1 on the app's own background — both fail WCAG AA's 4.5:1 body-text minimum (most uses here are 9–11px regular weight, not "large text"). The entire "Coming Up Next Week" row block (line 1140) wraps this already-marginal text in `opacity: 0.82`, lightening it further.
- **Why it matters**: Sandra uses this one-handed, often outdoors or in variable light. The exact details she needs at a glance — "drive time," "est. from home," date labels — are rendered in the screen's hardest-to-read color/size combination.
- **Fix**: For any text under 14px, swap `inkMuted` for a darker value closer to ~4.7:1 contrast (the palette already has `#8D6E63` in the `secLabel` role), and replace the blanket `opacity: 0.82` with explicit, pre-checked-for-contrast color values.
- **Suggested command**: `$impeccable audit` (accessibility-focused pass) to catch this plus any sibling instances elsewhere in the app

## Persona Red Flags

**Casey (Distracted Mobile User — the persona that maps directly onto Sandra's actual daily use)**
- The active-job card offers **5 simultaneous tap targets** (open card, tap address, +30 MIN, +COST, WRAP UP) — a minefield for someone glancing at their phone mid-task; a stray tap on +COST launches two blocking `window.prompt` dialogs.
- The GO button's 1100ms "LAUNCHING…" delay plus flying-icon animation (lines 428–449) actively works against a distracted user: combined with a 1-second GPS timeout that silently falls back to a stale cached origin, she may tap again, assume it's broken, or pocket the phone before Maps opens.
- "Leave NOW" rendered in red (line 363) risks a startle-tap response — exactly the wrong reaction to want from someone walking to their car.

**Sam (Accessibility-Dependent User)**
- The borderline `inkMuted` contrast (3.0–3.3:1, see P3) fails AA on every drive-time, date, and "est. from home" label on the screen.
- Urgency is signaled almost entirely through color (`timingColor`: green/amber/red, line 748) — a colorblind user loses the escalation cue on several elements that have no paired icon or text redundancy.
- The pulsing "Mission Active" dot (line 622, `animation: 'pulse 2s infinite'`) has no `prefers-reduced-motion` guard — a vestibular-sensitive user gets an unavoidable pulsing element on the one screen they can't skip.

## Minor Observations

1. **Lines 685/690**: "est. from home" — a genuinely useful transparency note about data freshness — is rendered at 9px on `inkMuted`, the smallest and lowest-contrast combination on the screen. Important context, buried.
2. **Lines 760–764, 1019–1027**: notes are clamped to 2 lines (`WebkitLineClamp`) with no "…more" affordance — Sandra has no signal that there's more to read.
3. **Line 1056**: "3 owing · $240" buries the dollar figure (what she cares about) behind the count (what she doesn't). Consider "$240 owing across 3 clients."
4. **Lines 947 vs 1127**: `fmtTimeRange` row-rendering logic is duplicated nearly verbatim between Rest-of-Week and Next-Week blocks — a shared row component removes this for free as a side effect of the P1 consolidation fix above.
5. **Lines 401–426**: six separate `useState` hooks (`isRefreshingTraffic`, `isGoLaunching`, `isFlyingIcon`, `locationDrives`, `locationLoading`, `lastKnownOrigin`) all belong to one conceptual "drive/location/launch" feature — a small custom hook or `useReducer` would simplify reasoning about (and debugging) the GO-button state machine.
6. **Line 1208**: the keyboard-padding spacer animates `height` directly (flagged by the detector as `layout-transition`) — low-impact given it's a tiny spacer, but `transform`/`max-height` would avoid the layout-thrash pattern entirely, and the same rule fired elsewhere (`Settings.jsx:348`), suggesting it's worth a sweep.

## Questions to Consider

- "What if 'Rest of This Week' and 'Coming Up Next Week' collapsed into the same kind of accordion that already makes 'Owing' feel calm rather than overwhelming — would that alone be enough to make this screen feel like 'one glance and I'm done'?"
- "What if the superhero vocabulary disappeared for a week — 'Today' instead of 'Command Brief,' 'Up next' instead of 'Mission Active' — would Sandra (a self-described silent reporter who routes around things rather than naming them) actually feel more at ease, even if she never says so?"
- "What would it take to make 'Done This Week' the moment Sandra feels good about her day, instead of a faded list she scrolls past to get to tomorrow's jobs?"
