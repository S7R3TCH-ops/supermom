# Product

## Register

product

## Users

The primary user is **the solo operator** — someone running a one-person personal-services business (organizing, decluttering, caregiving, coaching, errands) entirely from their phone, between client calls and texts. Right now that's **Sandra**, in Georgetown, ON, and she's the concrete lens every design decision should be checked against: non-technical, juggling the app between jobs, never going to file a clean bug report (she'll just go quiet on a broken flow).

A secondary user is the **super admin** (Joel), who switches "viewpoints" to see any business — an internal/operational view, not the product's primary face.

This is built as a **managed-service product**: Sandra is the first tenant, and the architecture already anticipates others. But the near-term design lens stays Sandra-specific — don't abstract the UI into generic "configurable for any operator" territory before there's a second operator to design for. Write and design for Sandra's actual day; let the next version (when it comes) generalize from what's proven, not from speculation.

The job to be done, every time someone opens this app: see what's next, get there, get paid, move on — without the app being one more thing to manage.

## Product Purpose

A mobile-first CRM and operations tool that runs a solo personal-services business end to end: scheduling, client records, job tracking, invoicing, and payment status — all from a phone, all in real time, between appointments.

Success looks like Sandra trusting the app enough to run her whole day through it without double-checking it on paper, and never hitting a wall she can't silently work around (because she will route around problems instead of reporting them).

## Brand Personality

**Kick-ass Mary Poppins.** Capable, warm, quietly magical — the kind of person who makes an impossible day look effortless and never breaks a sweat doing it. That's the feeling the app should give its user about *themselves*: "I've got this, and I look good doing it."

Three words: **capable, warm, unflappable.**

- Professional but comfortable — like a well-run kitchen, not a boardroom
- A little personality and warmth, never cutesy or toy-like
- Confidence without noise: the app should feel like it's quietly handling a hundred things in the background so the user doesn't have to think about any of them
- Dial back any literal "superhero" iconography or language — a little of that energy is fine as an undertone (DESIGN.md's "bright pink heart"), but leaning on it visually reads amateur, not aspirational

## Anti-references

- **"Vibe-coded in 24 hours" AI-app look** — inconsistent spacing, generic component-library defaults, mismatched type scales, the unmistakable tell of something thrown together. This is the single biggest thing to avoid; it undercuts trust in a tool people run their livelihood through.
- **Toy-like / cartoon "superhero" treatments** — comic-book badges, cape iconography, exclamation-heavy copy. Reads as amateur and undermines the "capable professional" feeling.
- **Cold corporate SaaS** — gray dashboards, hero-metric tiles, enterprise-chrome. Wrong register entirely; this is a personal tool for a personal business, not an ops console for a team.

## Design Principles

1. **Make the hard parts invisible.** Behind every simple-looking screen is real complexity (scheduling, drive times, payment reconciliation, calendar sync). The UI's job is to make that complexity disappear, not to show its work.
2. **No surprises.** The primary user is non-technical and won't report bugs — she'll just stop trusting a flow that misbehaves once. Conservative, predictable, consistent over clever.
3. **Capable, not flashy.** Confidence is communicated through clarity and polish, not through visual noise, gradients-for-their-own-sake, or "look how powerful I am" affordances.
4. **Built for the in-between moments.** Every screen is designed to be used one-handed, mid-task, on a phone, with partial attention — between a client call and walking out the door.
5. **Design for the lens you have.** Sandra is the concrete user; design decisions should resolve against her real day, not a hypothetical future tenant. Generalize later, from evidence — not now, from speculation.

## Accessibility & Inclusion

- Standard mobile tap targets (≥44×44px), already a stated rule in DESIGN.md
- WCAG AA contrast minimum — body text ≥4.5:1, large/bold text ≥3:1
- Conservative, no-surprises interaction patterns for a non-technical daily user who won't self-report confusion or bugs
- **In-app feedback/bug-reporting is a real product need**, not a nice-to-have — because the target users won't go looking for a way to report problems on their own. (Functional requirement to track in the roadmap, not a visual-design concern for DESIGN.md.)
