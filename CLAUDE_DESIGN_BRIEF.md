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

- **Voice:** Warm, confident, direct. Like a trusted friend who happens to be extremely capable. No jargon, no corporate-speak, no hype.
- **Headlines:** Fraunces serif, slightly italic feel. Conversational, not salesy. Example: *"Your life, running smoothly at last."* / *"Georgetown's secret weapon for getting life in order."*
- **Body copy:** Inter, 15–16px, comfortable line-height (1.7). First-person where Sandra speaks. Plain English. Real.
- **CTAs:** Action-oriented but not pushy. "Get in Touch" / "Book a Consultation" / "See the Work" — not "BUY NOW" energy
- **Eyebrow labels:** Always `✦ LABEL TEXT` — 10px, uppercase, 1.2–1.4px letter-spacing, `--pink-label` color on dark, `--ink-muted` on light

---

## Placeholder content (replace with Sandra's real content when available)

Sandra will provide:
- Her professional headshot / personal photo
- Real before/after job photos (with client permission)
- Real client testimonials (3–5, genuine quotes)
- Her personal bio in her own words
- Her actual phone number and email
- Specific service pricing context (if she wants to show it)

For now, use clearly-labeled placeholders that match the layout exactly.

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
