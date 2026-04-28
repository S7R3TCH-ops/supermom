# Typography Standardization Design

**Date:** April 27, 2026  
**Status:** Approved  
**Topic:** Modernizing and centralizing typography components to enable future-proof styling and easy business-level customization.

## 1. Objective
Replace scattered inline styles and the existing single `SectionLabel` component with a comprehensive suite of semantic typography components. This allows for global styling changes, theme-aware text rendering, and a more consistent visual language.

## 2. Architecture
All typography components will reside in `src/components/ui/typography/`. They will use `AppThemeContext` to consume tokens and respond to mode changes.

### 2.1 Core Components

| Component | Usage | Font | Style Notes |
|---|---|---|---|
| `Title` | Page-level headers | `T.serif` | Large (24-32px), bold, responsive |
| `Subheading` | Card titles, subsection headers | `T.serif` | Medium (18-22px), medium-bold |
| `SectionLabel` | Grouping headers (e.g., "THIS WEEK") | `T.font` | Small (9px), 800 weight, uppercase, 1px tracking |
| `Text` | Standard body copy | `T.font` | Variants: `primary`, `secondary`, `muted` |
| `Caption` | Metadata, timestamps, tiny hints | `T.font` | Smallest (10-11px), often `T.inkMuted` |

## 3. Implementation Details

### 3.1 Base Pattern
All components will follow this pattern:
```jsx
export default function Title({ children, style, ...props }) {
  const { T } = useAppTheme();
  return (
    <div style={{
      fontFamily: T.serif,
      color: T.ink,
      fontSize: 28,
      fontWeight: 600,
      ...style
    }} {...props}>
      {children}
    </div>
  );
}
```

### 3.2 Transition Plan
1. **Scaffold:** Create the folder and components.
2. **Standardize `SectionLabel`:** Update the existing `SectionLabel` and move it to the new folder.
3. **Migration:**
   - Replace `T.serif` inline styles in `Home.jsx`, `ClientProfile.jsx`, etc., with `Title` and `Subheading`.
   - Replace `T.font` inline styles with `Text` and `Caption`.
   - Update imports across the app.

## 4. Success Criteria
- [ ] No more "raw" `div` styles for typography in main pages.
- [ ] App visual identity remains unchanged (initial parity).
- [ ] Future font or size changes can be made in a single file per component.
- [ ] "Warm/Dark" mode transitions continue to work flawlessly.

(Updated by Gemini CLI)
