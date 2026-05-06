# Service Catalog UX Hardening Design

> **Status:** Approved
> **Date:** 2026-05-06
> **Author:** Gemini CLI

## Goal
Prevent accidental data loss in the Service Catalog by warning users when they attempt to close the sheet with unsaved changes.

## Architecture

### 1. Change Tracking (Dirty State)
- **Reference Snapshot:** Store a "clean" version of the services list (`initialData`) immediately after fetching from Supabase.
- **Comparison Logic:** Implement a `checkIsDirty()` function or a `useMemo` that compares the current `formServices` and `deletedIds` against the snapshot.
- **Deep Equality:** Use `JSON.stringify` or a field-by-field comparison, ensuring we ignore transient UI state like `tempId`, `isNew`, or `loading` flags.

### 2. User Flow Interception
- **Close Hijacking:** Modify the internal `handleClose` logic to check `isDirty`.
- **Confirmation Dialog:** If dirty, use `window.confirm` to ask the user: *"You have unsaved changes. Discard them?"*
- **Backdrop/Escape Protection:** Ensure the check applies to clicking the backdrop, the "×" button, and the "Cancel" button.

### 3. UI Enhancements
- **Discard Button:** (Optional) Add a "Discard" button in the footer when dirty to make the "reset" action explicit.
- **Visual Feedback:** Consider showing a subtle "Unsaved Changes" indicator (e.g., an asterisk or text) near the Save button.

## Implementation Details
- **File:** `src/components/sheets/ServiceCatalogSheet.jsx`
- **Key States:** 
    - `snapshot`: `[]` (the baseline data)
    - `isDirty`: `boolean` (computed)

## Testing Strategy
1. Open Service Catalog.
2. Close immediately (no warning expected).
3. Change a service name, try to close (warning expected).
4. Click "Cancel" on warning (sheet stays open, changes kept).
5. Click "OK" on warning (sheet closes, changes lost).
6. Save changes (sheet closes, data persists, no warning on next open).
