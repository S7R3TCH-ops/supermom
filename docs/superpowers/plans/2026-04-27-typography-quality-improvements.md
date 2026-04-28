# Typography Components Quality Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the quality, flexibility, and ease of use of the typography components in `src/components/ui/typography/`.

**Architecture:** 
- Add a centralized `index.js` for easier imports.
- Update each component to support a `component` prop for semantic HTML (e.g., `h1`, `h2`, `p`, `small`).
- Support both default and named exports for flexibility.
- Use a dynamic component tag in JSX.

**Tech Stack:** React (JSX)

---

### Task 1: Create index.js

**Files:**
- Create: `src/components/ui/typography/index.js`

- [ ] **Step 1: Create the index.js file with exports**

```javascript
export { default as Title } from './Title';
export { default as Subheading } from './Subheading';
export { default as Text } from './Text';
export { default as Caption } from './Caption';
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/typography/index.js
git commit -m "style: add index.js to typography components"
```

### Task 2: Enhance Title Component

**Files:**
- Modify: `src/components/ui/typography/Title.jsx`

- [ ] **Step 1: Update Title to support component prop and named export**

```javascript
import { useAppTheme } from '../../../context/AppThemeContext';

export function Title({ children, component: Component = 'h1', style, ...props }) {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: T.serif,
      color: T.ink,
      fontSize: 28,
      fontWeight: 600,
      margin: 0, // Reset default margin for semantic tags
      ...style
    }} {...props}>
      {children}
    </Component>
  );
}

export default Title;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/typography/Title.jsx
git commit -m "style: enhance Title with semantic component prop and named export"
```

### Task 3: Enhance Subheading Component

**Files:**
- Modify: `src/components/ui/typography/Subheading.jsx`

- [ ] **Step 1: Update Subheading to support component prop and named export**

```javascript
import { useAppTheme } from '../../../context/AppThemeContext';

export function Subheading({ children, component: Component = 'h2', style, ...props }) {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: T.serif,
      color: T.ink,
      fontSize: 20,
      fontWeight: 600,
      margin: 0, // Reset default margin for semantic tags
      ...style
    }} {...props}>
      {children}
    </Component>
  );
}

export default Subheading;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/typography/Subheading.jsx
git commit -m "style: enhance Subheading with semantic component prop and named export"
```

### Task 4: Enhance Text Component

**Files:**
- Modify: `src/components/ui/typography/Text.jsx`

- [ ] **Step 1: Update Text to support component prop and named export**

```javascript
import { useAppTheme } from '../../../context/AppThemeContext';

export function Text({ children, variant = 'primary', component: Component = 'p', style, ...props }) {
  const { T } = useAppTheme();
  let color = T.ink;
  if (variant === 'secondary') color = T.inkSub;
  if (variant === 'muted') color = T.inkMuted;
  
  return (
    <Component style={{
      fontFamily: T.font,
      color,
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.5,
      margin: 0, // Reset default margin for semantic tags
      ...style
    }} {...props}>
      {children}
    </Component>
  );
}

export default Text;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/typography/Text.jsx
git commit -m "style: enhance Text with semantic component prop and named export"
```

### Task 5: Enhance Caption Component

**Files:**
- Modify: `src/components/ui/typography/Caption.jsx`

- [ ] **Step 1: Update Caption to support component prop and named export**

```javascript
import { useAppTheme } from '../../../context/AppThemeContext';

export function Caption({ children, component: Component = 'small', style, ...props }) {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: T.font,
      color: T.inkMuted,
      fontSize: 11,
      fontWeight: 500,
      display: 'block', // small is inline by default, div was block
      ...style
    }} {...props}>
      {children}
    </Component>
  );
}

export default Caption;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/typography/Caption.jsx
git commit -m "style: enhance Caption with semantic component prop and named export"
```
