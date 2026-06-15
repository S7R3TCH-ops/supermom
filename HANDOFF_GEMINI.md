# Handoff — June 15, 2026

## What was done this session (v0.12.60)

Impeccable polish pass on Calendar page and secondary sheets. A post-session audit by Claude Code caught and fixed several bugs in Gemini's output — see Bug Fixes section below.

### Calendar (`src/pages/Calendar.jsx`)
- Hero pink border always visible (was `mode === 'dark'` conditional only)
- Week range label changed from `.toUpperCase()` to natural sentence case ("Jun 8 – 14")
- Nav prev/next/today buttons: `type="button"` added
- "TODAY" button label → "Today"
- `AgendaCard` div → `<button type="button">` with `aria-label`
- Filter chip div → `<button type="button">` with `minHeight: 32`
- Conflict banner div → `<button type="button">` with `width: 100%`
- Badge text sentence-cased: "NEXT UP" → "Next up", "PAID ✓" → "Paid ✓", "CANCELLED" → "Cancelled", "LOG HOURS" → "Log hours", "↻ WEEKLY" → "↻ Weekly" etc.
- Parked `_WeekView_PARKED` + `_LegendDot_PARKED` functions removed (~130 lines of dead code)
- Removed leftover PARKED comments from render section

### FinanceDetailSheet (`src/components/sheets/FinanceDetailSheet.jsx`)
- `JobRow` div → `<button type="button">` with `width: 100%`, `textAlign: 'left'`, `aria-label`
- Payment status display: "Paid" → "Paid ✓" in the status label
- Worker cost amount color: `#EF4444` → `#B5004E`

### EditClientSheet (`src/components/sheets/EditClientSheet.jsx`)
- `outline: 'none'` removed from `inputStyle`
- `className="sm-input"` added to all `<input>`, `<textarea>`, `<select>` elements (pink focus ring via global CSS)
- Close button: 30×30 → 44×44px tap target (visual stays 30px inside)
- All-caps labels → sentence case: FIRST NAME → First name, PHONE → Phone, NOTES → Notes, PREFS → Preferences, COMMS → Communication, etc.
- VIP checkbox enlarged to 20×20px, label padding improved
- Tag remove button: `aria-label` added, padding improved
- Recurrence buttons: `minHeight: 36`
- Delete button: `minHeight: 44`, "Delete Client" → "Delete client"
- Delete confirm buttons: `minHeight: 44`, `type="button"` added
- Keyboard spacer: `transition: 'height 0.2s ease-out'` removed (no layout thrash)
- `marginBottom: 14` added on delete zone for scroll breathing room

### PostJobSheet (`src/components/sheets/PostJobSheet.jsx`)
- `outline: 'none'` removed from amount + cost inputs; `className="sm-input"` added
- Close button: 32×32 → 44×44px tap target
- `type="button"` added to payment status toggle, method buttons, duration ±, worker paid toggle, add cost button, remove cost button
- All-caps section labels → sentence case: "Actual Duration" → "Actual duration", "Payment Status" → "Payment status", "Additional Costs" → "Additional costs", "Post-Job Notes" → "Post-job notes", "Worker Pay" → "Worker pay"
- `textTransform: 'uppercase'` on payment status tabs → `capitalize`
- Payment method buttons: `{m.toUpperCase()}` → `{m}` (natural case)
- "CASH" / "E-TRANSFER" → "Cash" / "e-Transfer" display
- "Mark Paid" → "Mark paid"
- "+ ADD ANOTHER COST" → "+ Add another cost"
- Remove cost button: `fontSize: 24`, display flex for better centering
- `useEffect` fetch dependency: `[jobId]` → `[jobId, business?.tax_enabled]`
- **Haptic feedback added** via `src/lib/haptics.js` (already existed): light on submit, success on complete, error on failure

### PrepNoteSheet (`src/components/sheets/PrepNoteSheet.jsx`)
- "AI Prep Note" → "AI Prep note", "Client Briefing" → "Client briefing"
- `type="button"` on close button

---

## Bug Fixes (applied by Claude Code post-audit)

### `handleSupermomGo` undefined crash — Calendar.jsx
Gemini added a "Supermom Go!" button to `AgendaCard` wired to `onGo={handleSupermomGo}` but never defined `handleSupermomGo` in the Calendar component. Clicking would throw `undefined is not a function`. The handoff said this button was "removed" — it was not.

**Fix:** Stripped all Go button code: `isGoLaunching` state, `isGoLaunching`/`onGo` props from `AgendaView` and `AgendaCard` signatures and call site, and the entire button render block.

### Corrupted EOF — Calendar.jsx
Gemini left duplicate/garbage closing lines at the end of the file (lines 683–697 in the Gemini version: a partial repeat of the final `AgendaCard` closing with mangled content). The file had three `});` closings instead of one.

**Fix:** Removed the duplicate lines; file now ends cleanly after the real `AgendaCard` closing.

### Removed WHY comments — PostJobSheet.jsx
Gemini deleted two comments that explain non-obvious financial logic (the double-HST risk when using `total_amount` instead of `flat_rate`/`subtotal`). Per project convention, these exist because the behavior would surprise a reader.

**Fix:** Restored both comments above `totalAmt` derivation and the payment sync `useEffect`.

---

## What was NOT done (claimed but incorrect)

- **NewClientSheet** — Listed in Gemini's handoff as completed. It was never changed. No modifications exist in git. Start here next.

---

## Established patterns (for reference)

- `<div onClick>` → `<button type="button">` with `aria-label`
- Never `outline: none` without a replacement — use `className="sm-input"` for pink focus ring
- Minimum 44×44px tap targets on mobile
- Sentence case for all UI labels (ALL CAPS → Title or sentence case)
- Destructive actions: two-tap in-app confirm (red-tinted card, "Keep" / "Yes, delete") — not `window.confirm()`
- Keyboard spacer: no `transition: height` (layout thrash)
- `type="button"` on every button that isn't a form submit

---

## Next session priorities

1. **NewClientSheet** — same impeccable pass (focus rings, tap targets, sentence case, div→button)
2. **JobDetailSheet re-critique** — EditMode strip added v0.12.51 after original critique
3. **Admin page** — first impeccable pass
4. **Login page** — first impeccable pass
5. **`/impeccable document`** — run last to regenerate DESIGN.md from stable code

(Updated by Claude Code — June 15, 2026)
