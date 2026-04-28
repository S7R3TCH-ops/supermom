# Typography Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a suite of robust semantic typography components to replace inline styles and allow for future-proof global styling changes.

**Architecture:** Create atomic components (`Title`, `Subheading`, `SectionLabel`, `Text`, `Caption`) in `src/components/ui/typography/` that consume the theme from `AppThemeContext`. Migrate the existing `SectionLabel` and update all usages across the app.

**Tech Stack:** React, CSS-in-JS (inline styles with `T` tokens).

---

### Task 1: Create Typography Base Components

**Files:**
- Create: `src/components/ui/typography/Title.jsx`
- Create: `src/components/ui/typography/Subheading.jsx`
- Create: `src/components/ui/typography/Text.jsx`
- Create: `src/components/ui/typography/Caption.jsx`

- [ ] **Step 1: Write the `Title` component**

Create `src/components/ui/typography/Title.jsx`:

```jsx
import { useAppTheme } from '../../../context/AppThemeContext';

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

- [ ] **Step 2: Write the `Subheading` component**

Create `src/components/ui/typography/Subheading.jsx`:

```jsx
import { useAppTheme } from '../../../context/AppThemeContext';

export default function Subheading({ children, style, ...props }) {
  const { T } = useAppTheme();
  return (
    <div style={{
      fontFamily: T.serif,
      color: T.ink,
      fontSize: 20,
      fontWeight: 600,
      ...style
    }} {...props}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Write the `Text` component**

Create `src/components/ui/typography/Text.jsx`:

```jsx
import { useAppTheme } from '../../../context/AppThemeContext';

export default function Text({ children, variant = 'primary', style, ...props }) {
  const { T } = useAppTheme();
  
  let color = T.ink;
  if (variant === 'secondary') color = T.inkSub;
  if (variant === 'muted') color = T.inkMuted;

  return (
    <div style={{
      fontFamily: T.font,
      color,
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.5,
      ...style
    }} {...props}>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Write the `Caption` component**

Create `src/components/ui/typography/Caption.jsx`:

```jsx
import { useAppTheme } from '../../../context/AppThemeContext';

export default function Caption({ children, style, ...props }) {
  const { T } = useAppTheme();
  return (
    <div style={{
      fontFamily: T.font,
      color: T.inkMuted,
      fontSize: 11,
      fontWeight: 500,
      ...style
    }} {...props}>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Run tests (Linting)**

Run: `npm run lint` or `npx eslint src/components/ui/typography/` to ensure no syntax errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/typography/Title.jsx src/components/ui/typography/Subheading.jsx src/components/ui/typography/Text.jsx src/components/ui/typography/Caption.jsx
git commit -m "feat(ui): add core typography components (Title, Subheading, Text, Caption)"
```

---

### Task 2: Migrate SectionLabel Component

**Files:**
- Move & Modify: `src/components/ui/SectionLabel.jsx` -> `src/components/ui/typography/SectionLabel.jsx`
- Modify: `src/pages/Home.jsx`
- Modify: `src/pages/Admin.jsx`
- Modify: `src/pages/ClientProfile.jsx`
- Modify: `src/pages/Finance.jsx`
- Modify: `src/pages/Settings.jsx`
- Modify: `src/components/sheets/ServiceCatalogSheet.jsx`
- Modify: `src/components/sheets/PostJobSheet.jsx`
- Modify: `src/components/sheets/NewJobSheet.jsx`

- [ ] **Step 1: Move and update the `SectionLabel` component**

Move the file to the new folder and update it to accept a standard `style` prop while keeping its current signature for backward compatibility.

Create `src/components/ui/typography/SectionLabel.jsx` (and delete the old one):

```jsx
import { useAppTheme } from '../../../context/AppThemeContext';

export default function SectionLabel({ children, color, style, ...props }) {
  const { T } = useAppTheme();
  return (
    <div style={{
      fontFamily: T.font,
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: '1px',
      textTransform: 'uppercase',
      color: color || T.secLabel,
      marginBottom: 8,
      ...style
    }} {...props}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Update imports in dependent files**

Run a find-and-replace across the codebase to update the import path.

For example, in `src/pages/Home.jsx`:
Change: `import SectionLabel from '../components/ui/SectionLabel';`
To: `import SectionLabel from '../components/ui/typography/SectionLabel';`

Update imports in:
- `src/pages/Home.jsx`
- `src/pages/Admin.jsx`
- `src/pages/ClientProfile.jsx`
- `src/pages/Finance.jsx`
- `src/pages/Settings.jsx`
- `src/components/sheets/ServiceCatalogSheet.jsx`
- `src/components/sheets/PostJobSheet.jsx`
- `src/components/sheets/NewJobSheet.jsx`

Delete `src/components/ui/SectionLabel.jsx`.

- [ ] **Step 3: Run app to verify it still renders**

Run the dev server (`npm start` or verify `vercel dev`) and check the Home page to ensure `SectionLabel` still renders correctly without import errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/typography/SectionLabel.jsx src/components/ui/SectionLabel.jsx src/pages/ src/components/sheets/
git commit -m "refactor(ui): move SectionLabel to typography folder and update imports"
```

---

### Task 3: Migrate Home.jsx Typography

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Import typography components**

In `src/pages/Home.jsx`, add:
```jsx
import Title from '../components/ui/typography/Title';
import Subheading from '../components/ui/typography/Subheading';
import Text from '../components/ui/typography/Text';
import Caption from '../components/ui/typography/Caption';
```

- [ ] **Step 2: Replace `LiveTimer` font styles**

In the `LiveTimer` component within `Home.jsx`, replace the inline styles with `Title`:

Change:
```jsx
  return (
    <div style={{ fontFamily: T.serif, fontSize: 32, fontWeight: 600, color: 'white', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
      {elapsed}
    </div>
  );
```
To:
```jsx
  return (
    <Title style={{ fontSize: 32, color: 'white', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
      {elapsed}
    </Title>
  );
```

- [ ] **Step 3: Replace `EmptyState` font styles**

In the `EmptyState` component within `Home.jsx`:

Change:
```jsx
      <div style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, lineHeight: 1.5 }}>
        {msg[persona] || msg.professional}
      </div>
```
To:
```jsx
      <Subheading style={{ fontSize: 16, lineHeight: 1.5 }}>
        {msg[persona] || msg.professional}
      </Subheading>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "refactor(ui): migrate Home.jsx inline typography to semantic components"
```

---

### Task 4: Migrate Other Common Pages (Example: ClientProfile.jsx)

**Files:**
- Modify: `src/pages/ClientProfile.jsx`

- [ ] **Step 1: Import typography components**

In `src/pages/ClientProfile.jsx`, add:
```jsx
import Title from '../components/ui/typography/Title';
import Subheading from '../components/ui/typography/Subheading';
import Text from '../components/ui/typography/Text';
```

- [ ] **Step 2: Replace Page Header styles**

Find the main client name header (usually `fontFamily: T.serif`, `fontSize: 24` or similar).

Change:
```jsx
<div style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 600, color: T.ink }}>{client.name}</div>
```
To:
```jsx
<Title>{client.name}</Title>
```

*(Note: Depending on exact sizes in the file, use `style={{ fontSize: ... }}` if the default Title size needs adjustment).*

- [ ] **Step 3: Commit**

```bash
git add src/pages/ClientProfile.jsx
git commit -m "refactor(ui): migrate ClientProfile.jsx inline typography to semantic components"
```

*(This plan focuses on setting up the foundation and migrating key components. A full migration of every file would follow the same pattern as Task 3 & 4).*