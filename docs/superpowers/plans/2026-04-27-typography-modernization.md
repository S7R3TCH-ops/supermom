# Typography Components Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize typography components to match the `Title.jsx` pattern, supporting dynamic tags and named exports.

**Architecture:** Refactor functional components to arrow functions with both named and default exports. Add `component` prop for semantic tag flexibility and reset margins for consistent layout.

**Tech Stack:** React, CSS-in-JS (inline styles).

---

### Task 1: Update Subheading.jsx

**Files:**
- Modify: `src/components/ui/typography/Subheading.jsx`

- [ ] **Step 1: Refactor Subheading to arrow function with named export**

```jsx
import { useAppTheme } from '../../../context/AppThemeContext';

export const Subheading = ({ children, component: Component = 'h2', style, ...props }) => {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: T.serif,
      color: T.ink,
      fontSize: 20,
      fontWeight: 600,
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Component>
  );
};

export default Subheading;
```

- [ ] **Step 2: Commit changes**

```bash
git add src/components/ui/typography/Subheading.jsx
git commit -m "refactor(typography): modernize Subheading component with named export and arrow function"
```

### Task 2: Update Text.jsx

**Files:**
- Modify: `src/components/ui/typography/Text.jsx`

- [ ] **Step 1: Refactor Text to arrow function with named export and component prop**

```jsx
import { useAppTheme } from '../../../context/AppThemeContext';

export const Text = ({ children, variant = 'primary', component: Component = 'div', style, ...props }) => {
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
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Component>
  );
};

export default Text;
```

- [ ] **Step 2: Commit changes**

```bash
git add src/components/ui/typography/Text.jsx
git commit -m "refactor(typography): modernize Text component with named export and component prop"
```

### Task 3: Update Caption.jsx

**Files:**
- Modify: `src/components/ui/typography/Caption.jsx`

- [ ] **Step 1: Refactor Caption to arrow function with named export and component prop**

```jsx
import { useAppTheme } from '../../../context/AppThemeContext';

export const Caption = ({ children, component: Component = 'div', style, ...props }) => {
  const { T } = useAppTheme();
  return (
    <Component style={{
      fontFamily: T.font,
      color: T.inkMuted,
      fontSize: 11,
      fontWeight: 500,
      margin: 0,
      ...style
    }} {...props}>
      {children}
    </Component>
  );
};

export default Caption;
```

- [ ] **Step 2: Commit changes**

```bash
git add src/components/ui/typography/Caption.jsx
git commit -m "refactor(typography): modernize Caption component with named export and component prop"
```

### Task 4: Verify index.js

**Files:**
- Read: `src/components/ui/typography/index.js`

- [ ] **Step 1: Verify all components are exported**

Ensure the file contains:
```javascript
export { default as Title } from './Title';
export { default as Subheading } from './Subheading';
export { default as Text } from './Text';
export { default as Caption } from './Caption';
```
(Already verified in research phase)
