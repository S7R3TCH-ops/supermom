# Service Catalog Deletion Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a visual "Mark for Deletion" state with an Undo option for the Service Catalog.

**Architecture:** Use a `pendingDeleteIds` state to track services marked for removal. Update the UI to style marked cards and disable their inputs. Modify the save logic to handle these pending deletions.

**Tech Stack:** React, Supabase, Vanilla CSS.

---

### Task 1: State & Toggle Logic

**Files:**
- Modify: `src/components/sheets/ServiceCatalogSheet.jsx`

- [ ] **Step 1: Add pendingDeleteIds state**

Add `const [pendingDeleteIds, setPendingDeleteIds] = useState([]);` near the top.

- [ ] **Step 2: Implement handleToggleDelete**

```javascript
const handleToggleDelete = (id) => {
  if (!id) return; // Ignore new unsaved items for now, or handle them
  setPendingDeleteIds(prev => 
    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
  );
};
```

- [ ] **Step 3: Update isDirty logic**

Include `pendingDeleteIds` in the `isDirty` comparison.

```javascript
const isDirty = useMemo(() => {
  if (!snapshot) return false;
  const current = JSON.stringify({ 
    services: formServices, 
    deleted: deletedIds,
    pendingDelete: pendingDeleteIds
  });
  return current !== snapshot;
}, [formServices, deletedIds, pendingDeleteIds, snapshot]);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/sheets/ServiceCatalogSheet.jsx
git commit -m "feat: add pending deletion state to Service Catalog"
```

---

### Task 2: UI Visuals & Undo Button

**Files:**
- Modify: `src/components/sheets/ServiceCatalogSheet.jsx`

- [ ] **Step 1: Apply conditional styling to service cards**

Calculate `isPendingDelete = pendingDeleteIds.includes(s.id)`.
Apply `opacity`, `filter`, and `pointer-events` (or `disabled` to inputs) based on this flag.

- [ ] **Step 2: Update the Delete button**

Change the "×" button to an "Undo" icon/text when `isPendingDelete` is true.
Update the `onClick` to use `handleToggleDelete`.

- [ ] **Step 3: Commit**

```bash
git add src/components/sheets/ServiceCatalogSheet.jsx
git commit -m "ui: implement mark-for-deletion visuals and undo button"
```

---

### Task 4: Save Logic Integration

**Files:**
- Modify: `src/components/sheets/ServiceCatalogSheet.jsx`

- [ ] **Step 1: Update handleSave to include pending deletions**

Merge `pendingDeleteIds` into the soft-delete update.
Filter `pendingDeleteIds` out of the upsert list.

- [ ] **Step 2: Reset pendingDeleteIds on success**

Call `setPendingDeleteIds([])` in the success block.

- [ ] **Step 3: Commit**

```bash
git add src/components/sheets/ServiceCatalogSheet.jsx
git commit -m "feat: integrate pending deletions into save process"
```
