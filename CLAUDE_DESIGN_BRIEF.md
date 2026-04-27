# Claude Design Brief — Supermom for Hire Website

> Paste this entire document into Claude Design at the start of your session.
> Also upload: `public/branding/logo-final.png` and `website-mockup.html` (reference only).

---

## What we're building

A **public-facing marketing website** for **Supermom for Hire** — a solo personal-life-operations business run by Sandra in Georgetown, Ontario. She offers home organizing, decluttering, caregiving, life coaching, and errands — all booked personally after a client call or text.

This is **not** the internal CRM app (that already exists). This is the client-facing info site: who Sandra is, what she does, proof of her work (testimonials + before/after photos), and a contact form.

**The goal:** When a stressed Georgetown parent or adult child looking after an aging parent lands on this site, they should feel *immediate relief* — like they just found exactly the person they've been looking for.

---

## Brand direction

**Zen but powerful. Warm superhero energy.** Confident, human, real. Not corporate. Not generic. Not "AI-made."

**The one thing someone should remember:** A woman in Georgetown who makes life manageable — and her brand feels as capable and warm as she is.

**Audience:** Busy parents, families caring for elderly relatives, people who feel overwhelmed by their homes or routines. Georgetown, ON and surrounding Halton Hills area. Ages 35–65. They don't care about design — they care about trust and results.

---

## Existing app design system (source of truth)

This website must feel like it belongs to the same brand as the existing mobile app. The app's design tokens are below — **use these as your foundation**.

```css
:root {
  /* Brand */
  --pink:          #E91E6A;   /* primary CTA color */
  --pink-light:    #FF5A9D;   /* gradient start */
  --pink-mid:      #B01550;   /* hover, depth */
  --pink-pale:     #FFF9FB;   /* page background */
  --pink-tint:     #FFF0F7;   /* subtle selected states */
  --pink-border:   #FFD6E8;   /* card borders */
  --pink-label:    #FF78B0;   /* labels on dark backgrounds */

  /* Plum (dark sections) */
  --plum-dark:     #1A0A12;
  --plum-mid:      #2C0B1A;

  /* Ink (text on light) */
  --ink:           #1A0A12;
  --ink-mid:       #5A3040;
  --ink-muted:     #9B5A70;

  /* Gradients */
  --grad-pink:   linear-gradient(110deg, #FF4D96 0%, #E91E6A 45%, #B01550 100%);
  --grad-hero:   linear-gradient(145deg, #1A0A12 0%, #2C0B1A 100%);
  --grad-action: linear-gradient(135deg, #FF5A9D, #E91E6A);

  /* Radius */
  --r-card:  16px;
  --r-pill:  100px;

  /* Typography */
  --font-display: 'Fraunces', Georgia, serif;   /* ALL headlines, display, names */
  --font-ui:      'Inter', system-ui, sans-serif; /* ALL body, UI, buttons */
}
```

**Fonts (Google Fonts):**
```
Fraunces: ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500
Inter: wght@400;500;600;700
```

---

## Website-specific adaptations ("softer" direction)

The app is a dark, high-intensity mission-control interface for the operator. The website is for clients — it should feel **warmer, more approachable, and have more breathing room**, while still being unmistakably the same brand.

**Apply these adjustments on top of the base tokens:**

| Element | App version | Website version |
|---|---|---|
| Dark sections | `#1A0A12` / `#2C0B1A` | `#1C0D14` / `#2E1020` (slightly lighter) |
| Section backgrounds | Always pink-pale | Alternate: white → `#FEF0F5` blush → dark plum |
| Card borders | `#FFD6E8` | `#F5C8DA` (softer) |
| Spacing | Tight mobile (14px gutters) | Generous desktop (max-width 1160px, 80–100px section padding) |
| Shadows | Sharp, mobile | Soft, feathered: `0 4px 32px rgba(233,30,106,.07)` |
| Nav | Logo banner (full-width pink gradient) | Frosted glass: `rgba(255,248,251,.92)` + blur + pink-border bottom |
| Radial glows | Present in hero | Present in all dark sections, softer opacity (.14 not .22) |

---

## Site pages & structure

### Pages
- `/` — Homepage (one long scroll, all sections)
- `/services` — Service details with pricing context
- `/work` — Before/after gallery + job stories
- `/about` — Sandra's story
- `/contact` — Contact form + phone/text CTA

### Homepage sections (in order)

1. **Nav** — Frosted glass, sticky. Logo (white PNG on pink gradient pill) + nav links + "Book a Consultation" pill CTA.

2. **Hero** — Dark plum (`--grad-hero`), full-width, 3px pink bottom border. Two-column desktop layout: left = headline + sub + CTAs, right = floating stat/info cards. Radial pink glow top-right. Headline is large Fraunces serif. Sub-copy in Inter.
   - Headline feel: *"Your life, running smoothly at last."*
   - Eyebrow label: `✦ Georgetown, Ontario · Personal Operations` (10px, uppercase, `--pink-label` color)

3. **Services** — White background, grid of 5 service cards. Each card: pink gradient icon square, Fraunces title, Inter body. Cards use `--pink-border` border, 16px radius, hover lifts with pink shadow.
   - Services: Home Organizing · Decluttering · Caregiving · Life Coaching · Errands & Assistance

4. **Testimonials** — Dark plum section, 3px pink borders top and bottom. Three testimonial cards on dark glass background. Pull-quotes in Fraunces italic. Author name in `--pink-label`.

5. **Before & After** — Light background. 3-column grid of transformation cards. Each card: two-panel image (before left / after right) with white divider, section labels, job title + details below.

6. **About Sandra** — Blush-tinted background (`#FEF0F5`). Two-column: photo left, story right. Photo has pink border + small pink gradient badge ("Georgetown · Local & trusted"). Body copy is warm, first-person, personal. NOT a bio — a conversation.

7. **Contact CTA** — Dark plum, full-width. Centered. Contact form on dark glass panel. Fields: Name, Phone or Email, Service (select), Message. Submit button full-width pill, pink gradient. Below form: "Prefer to call or text?" + email link.

8. **Footer** — Deep plum. Logo left, copyright center, nav links right.

---

## Logo

- **File:** `logo-final.png` (uploading with this brief)
- **Important:** The logo is **white on transparent** — it is ONLY visible on dark or colored backgrounds. Never place it on white or light backgrounds without a dark/colored container.
- **Correct usage:** Place inside a `background: var(--grad-pink)` rounded container (like the app's nav banner)
- **In the nav:** Logo sits inside a small pink gradient pill/badge on the frosted nav bar

---

## Tone & copy direction

- **Voice:** Warm, funny, real, a little sarcastic — like your most capable friend who also swears occasionally and isn't afraid to call herself a "bad mom." NOT polished or corporate. NOT "wellness brand." Think: the friend who shows up with sleeves rolled and gets shit done, then makes you laugh about it.
- **Headlines:** Fraunces serif. Conversational, not salesy. Pull directly from her real language where possible:
  - *"We've got this."*
  - *"Your home. Your rules. My sleeves, rolled up."*
  - *"Good enough beats perfect every single time."*
  - *"Georgetown's secret weapon for getting life in order."*
  - *"Nothing phases me — and you don't have to do it alone."*
- **Body copy:** Inter, 15–16px, line-height 1.7. First-person. Direct. Short paragraphs. She uses exclamation marks and the occasional emoji — the copy should feel like a real person wrote it.
- **Anti-perfection is core messaging** — explicitly contrast against Pinterest/Instagram perfection culture. She's built her brand around rejecting that.
- **CTAs:** Warm and inviting, not pushy. "Let's talk." / "Get in touch." / "Reach out." — conversational, not transactional.
- **Signature sign-off:** Every major section or CTA area should feel like it could end with *"We've got this. 💗"*
- **Eyebrow labels:** Always `✦ LABEL TEXT` — 10px, uppercase, 1.2–1.4px letter-spacing, `--pink-label` color on dark, `--ink-muted` on light

---

## Sandra's real voice & content (sourced from Facebook posts, April 2026)

> This section replaces generic placeholders. Use this as the copy foundation — her actual words, phrases, and stories. Do not invent generic marketing copy when her real voice is better.

### Her signature sign-off
**"We've got this. 💗"** — closes nearly every post. Use this prominently on the site (hero section, contact CTA, or footer). It's her brand in four words.

### Her actual taglines & philosophy (use these verbatim or close to it)
- *"Sustainable systems tailored to how your family actually lives"*
- *"No judgment. No perfection pressure. No need for a million fancy organizers."*
- *"Good enough is SO much better and more freeing than perfect."*
- *"I'm not here to give you Pinterest-perfect rooms that fall apart in two days."*
- *"Self-care isn't always a bubble bath. Sometimes it's handing off some of your mental load."*
- *"Nothing phases me — and you don't have to do it alone."*
- *"I think fast, move fast and sometimes find the best solutions under pressure."*
- *"Big life changes are heavy. Moving, welcoming a new baby, navigating illness, aging parents… none of it is easy. The good news? Nothing phases me."*
- *"Trust me. Trust the process. And trust that I'll get it done right for you."*

### Real testimonials (use these verbatim — client names omitted or first-name only)
1. *"I so love the fact that Sandra doesn't judge us. I think anybody else coming in here would just think we're pigs but she just handles it all and doesn't stress out… It's kind of cool that she's so chill, that a complete stranger can walk into my house and ask me to help clean and it feels normal."*
2. *"Moving is stressful, but Sandra made it so much easier! We were struggling to finish packing as our move date got closer, and she saved the day. She organized and packed the rest of our home in just a few hours. I wish I'd had her help from day one!"* ⭐⭐⭐⭐⭐
3. *"Your work and community speak for themselves. I am very impressed."* — Husband, after bedroom overhaul
4. *(Client, after PMDD support session)* — Sandra describes: "Making her feel seen because I got her… like really got her." Client sent a message of deep gratitude immediately after.
5. More testimonials and before/after photos to be added by Sandra.

### Her actual services (broader than originally listed — update the services section)
- **Home Organizing** — closets, kitchens, pantries, offices, whole homes (largest: 2,400 sq ft)
- **Decluttering** — judgment-free, sustainable systems, dollar-store solutions that actually work
- **Caregiving & Senior Support** — companionship, chores, errands, friendship for seniors in residences
- **Life Coaching & Mental Load Support** — especially for neurodivergent women, ADHD, PMDD
- **Errands & Assistance** — groceries, donations drop-off, plant care, last-minute tasks
- **Moving Support** — packing/unpacking, eleventh-hour saves, new home setup (kitchen first!)
- **Nesting Support** — for moms-to-be: nursery setup, house prep, "you direct, I execute"
- **PMDD / Neurodivergent Support** — recurring monthly support sessions for women who need help during hard windows
- **Last-Minute & Emergency Resets** — her specialty: 18-ft Christmas tree removal, basement cleared for surprise guests in a week, guest room reset for last-minute visitors

### Her audience (more specific than originally described)
Primary: overwhelmed moms, neurodivergent women (ADHD, PMDD), moms-to-be, mompreneurs
Secondary: families with aging parents / seniors needing companionship and support
Geographic: Georgetown ON, Halton Hills, has gone as far as Toronto

### Her key differentiators (work these into copy throughout)
1. **Judgment-free, always** — her #1 brand value, repeated constantly
2. **More valuable than therapy** — clients say this unprompted; she's in the trenches solving problems in real-time
3. **Affordable by design** — she explicitly prices below professional organizer rates; uses dollar-store solutions
4. **Village mentality** — she built this business to be the village that moms have lost; accessible, not luxury
5. **Nothing phases her** — last-minute chaos, impossible timelines, emotional sessions — she thrives
6. **Neurodivergent-affirming** — she "gets" ND brains in a way that others don't; this is a real differentiator
7. **Works while you're at work** — the surprise reveal for the overwhelmed mom coming home is a signature moment
8. **Sarcasm & warmth in equal measure** — she named herself "Supermom" knowing she's against the perfection myth; she's funny and self-aware

### Still needed from Sandra
- Her professional headshot / personal photo
- Before/after job photos (with client permission) — she has them, just needs to share
- Her actual phone number and email for the contact section
- Pricing context (hourly rate vs flat, whether she wants to publish it)
- Any specific testimonials she wants highlighted

---

## Hard rules — DO

- Every dark section has `border-bottom: 3px solid #E91E6A` (and border-top when sandwiched between light sections)
- Logo always sits inside a pink gradient container — never on a plain/white background
- All headlines use Fraunces. All body/UI text uses Inter.
- Pink (`#E91E6A`) is used as a **punctuation color** — CTAs, borders, labels, accents — not as a background wash
- Radial pink glow on every dark section (`::before` pseudo-element)
- Dark sections use `--grad-hero` gradient, never solid black or flat dark
- Cards: `1.5px solid #F5C8DA` border, `16px` radius, hover should lift + add pink shadow
- Section eyebrows use `✦` prefix character (not ❋ or * or →)
- Max content width: `1160px`, centered

---

## Hard rules — DON'T

- **Never** put the logo on a white/light background without a colored container
- **Never** use purple gradients, Space Grotesk, Roboto, or system fonts
- **Never** use Inter for headlines — that's Fraunces only
- **Never** use flat, solid colored hero sections — always `--grad-hero` with the radial glow
- **Never** generic stock-photo aesthetic or "AI template" layouts
- **Never** pink directly touching pink (always a dark section or white break between pink elements)
- **Never** skip the 3px pink `border-bottom` on dark hero sections
- **No** excessive animations or scroll-jacking — subtle entrance animations only
- **No** chatbots, popups, cookie banners, or anything that interrupts the experience

---

## Reference mockup

A reference homepage mockup (`website-mockup.html`) is included. It shows the design direction, color relationships, section order, and component treatments. **Use it as directional reference** — the goal is to refine and elevate it with real content and tighter execution, not reproduce it exactly.

The mockup demonstrates:
- Correct frosted glass nav with logo-in-pill treatment
- Two-column hero with dark plum + radial glow
- Service card grid treatment
- Dark testimonials section
- Before/after card layout
- About section two-column layout
- Contact form on dark glass panel

---

## What "success" looks like

A Georgetown mom or a son trying to help his elderly mother finds this site and within 10 seconds thinks: *"This is exactly who I need."* She feels capable, warm, local, and real. The site doesn't look like every other service business website. It feels like the app feels — purposeful, calm, and quietly confident.
