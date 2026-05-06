# Service Catalog UX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an "Unsaved Changes" warning and dirty-state tracking for the Service Catalog.

**Architecture:** Add a baseline snapshot state to compare against the current form. Intercept all close triggers (backdrop, close button, cancel button, escape key) to check for unsaved edits.

**Tech Stack:** React, Supabase, Vanilla CSS.

---

### Task 1: Baseline Snapshot & Dirty State Tracking

**Files:**
- Modify: `src/components/sheets/ServiceCatalogSheet.jsx`

- [ ] **Step 1: Add snapshot state and update logic**

Add `snapshot` state and update `refresh` to set it.

```javascript
const [snapshot, setSnapshot] = useState(null);

// Inside refresh():
const mapped = (data || []).map(s => ({
  ...s,
  use_business_default: s.default_price === null || s.default_price === 0,
  default_price: s.default_price !== null ? String(s.default_price) : String(business?.hourly_rate || 60),
  default_duration: String(s.default_duration || 120),
  isNew: false
}));
setFormServices(mapped);
setSnapshot(JSON.stringify({ services: mapped, deleted: [] }));
```

- [ ] **Step 2: Implement isDirty check**

```javascript
const isDirty = useMemo(() => {
  if (!snapshot) return false;
  const current = JSON.stringify({ 
    services: formServices, 
    deleted: deletedIds 
  });
  return current !== snapshot;
}, [formServices, deletedIds, snapshot]);
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sheets/ServiceCatalogSheet.jsx
git commit -m "feat: add dirty state tracking to Service Catalog"
```

---

### Task 2: Intercept Close Actions

**Files:**
- Modify: `src/components/sheets/ServiceCatalogSheet.jsx`

- [ ] **Step 1: Create a safe close handler**

```javascript
const attemptClose = () => {
  if (isDirty) {
    if (!window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
  }
  onClose();
};
```

- [ ] **Step 2: Replace all onClose calls with attemptClose**

Update the following:
- Backdrop click
- "×" button click
- "Cancel" button click
- `useFocusTrap` (if it takes an onClose)

- [ ] **Step 3: Commit**

```bash
git add src/components/sheets/ServiceCatalogSheet.jsx
git commit -m "feat: protect Service Catalog close with confirmation"
```

---

### Task 3: UI Feedback (Optional/Polished)

**Files:**
- Modify: `src/components/sheets/ServiceCatalogSheet.jsx`

- [ ] **Step 1: Show dirty indicator**

Add a small "•" or "Unsaved" text next to the "Save Catalog Changes" button text when `isDirty` is true.

- [ ] **Step 2: Commit**

```bash
git add src/components/sheets/ServiceCatalogSheet.jsx
git commit -m "ui: add dirty state indicator to Service Catalog"
```
