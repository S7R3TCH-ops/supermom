# Service Catalog Deletion Flow Design

> **Status:** Approved
> **Date:** 2026-05-06
> **Author:** Gemini CLI

## Goal
Improve the Service Catalog UX by replacing instant deletion with a visual "Mark for Deletion" state, allowing users to review and undo deletions before saving.

## Architecture

### 1. State Management
- **Pending Deletion**: Maintain a `pendingDeleteIds` state to track services marked for removal.
- **Unified List**: Keep all services (including those marked for deletion) in `formServices` to maintain their position in the list.

### 2. Visual Feedback
- **Deleted State Styling**:
    - `opacity: 0.4`
    - `filter: grayscale(1)`
    - `text-decoration: line-through` on the name.
    - Background tint: Subtle red/pink tint (`T.pink` with low alpha).
- **Interactions**:
    - Disable all inputs (name, price, duration, active checkbox) within a marked card.
    - Toggle the "Delete" button into an "Undo" button.

### 3. Logic Updates
- **Toggle Function**: A `handleToggleDelete(id)` function that adds/removes IDs from `pendingDeleteIds`.
- **Save Integration**: 
    - Merge `pendingDeleteIds` into the final deletion request.
    - Filter `pendingDeleteIds` out of the upsert list.

## Implementation Details
- **File**: `src/components/sheets/ServiceCatalogSheet.jsx`
- **Key States**: 
    - `pendingDeleteIds`: `[]`

## Testing Strategy
1. Open Service Catalog.
2. Click Delete on a service (card should dim/strike-through, not disappear).
3. Try to edit the name of a marked service (should be disabled).
4. Click Undo on the marked service (card should restore to normal).
5. Mark a service for deletion and click Save (service should be removed from DB and UI).
6. Mark a service for deletion and click Cancel (warning should trigger due to `isDirty`, data should be preserved on next open).
