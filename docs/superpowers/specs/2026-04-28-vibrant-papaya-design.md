# Design Spec: Vibrant Papaya Refresh (2026-04-28)

## Vision
Transform the Supermom UI from its current high-contrast "Corporate Pink" to a warm, editorial, and authentic "Vibrant Papaya" aesthetic. The goal is to maintain the "BAM!" impact of the Supermom brand while introducing the airy, premium feel of high-end lifestyle magazines (inspired by The Birds Papaya and Sabrina Zohar).

## 1. Color Palette (Vibrant Papaya)

We are moving from "Electronic" colors to "Organic/Fleshy" tones.

| Role | Color | Hex | Note |
|---|---|---|---|
| **Primary (BAM!)** | **Vibrant Papaya** | `#FF70A6` | Replaces `#E91E6A`. Used for FABs, main buttons, active states. |
| **Secondary** | **Terracotta** | `#D27D56` | Earthy accent for secondary info or depth. |
| **Background (Base)** | **Warm Cream** | `#FFF9F5` | Replaces `#FAF3F6`. The foundation of the "Airy" feel. |
| **Neutral (Dark)** | **Charcoal Plum** | `#1C1C1E` | Kept for high-contrast hero sections and primary text. |
| **Neutral (Soft)** | **Dusty Rose Tint** | `#FFF0F7` | For card accents and subtle backgrounds. |

## 2. Typography Strategy

*   **Fraunces (Serif) Expansion:** Increase usage of Fraunces for all headings, subheadings, and meaningful labels. It provides the "Editorial" feel.
*   **Inter (Sans) Refinement:** Used strictly for utility text and metadata.
*   **Case Styling:** Use uppercase `Inter` with generous letter-spacing (0.1em) for category labels to mimic the magazine style.

## 3. Layout & Whitespace ("The Air")

*   **Global Padding:** Increase default screen horizontal padding from `14px` to `18px`.
*   **Card Spacing:** Increase `margin-bottom` on job/client cards to create more visual separation.
*   **Borders:** Use thinner, more subtle borders for cards (`1px` instead of `1.5px`) but with slightly larger, softer shadows.

## 4. Component Updates

### Logo Bar
*   Maintain the pink gradient but use the new `#FF70A6` as the core.
*   Increase top/bottom padding slightly for more "breath".

### Standard Cards
*   Background: White.
*   Border: `1px solid #FFD6E8`.
*   Shadow: `0 4px 12px rgba(255, 112, 166, 0.08)`.

### Hero Sections
*   Maintain the Dark Plum background but ensure the 3px pink bottom border uses the new `#FF70A6`.

## 5. Implementation Steps

1.  **Token Update:** Update `src/lib/tokens.js` with the new color palette.
2.  **Typography Migration:** Ensure the new Typography components from Phase 21 are used everywhere with the Serif focus.
3.  **Global Style Pass:** Update `index.css` for background colors and global spacing.
4.  **Component Refresh:** Audit cards and buttons to ensure they match the new "soft but bold" aesthetic.
