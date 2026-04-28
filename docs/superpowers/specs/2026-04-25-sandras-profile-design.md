# Design Spec: Sandra's Profile & Account

## 1. Objective
Enable Sandra to manage her personal identity within the app, including her name, initials-based avatar, and a professional signature line that the AI automatically appends to all drafted communications (Thank-you notes and Receipts).

## 2. Background
Currently, the app lacks a way for users to edit their personal details. The `users` table holds basic login info, but needs a flexible way to store metadata like a signature. This is a key step towards the "managed service" vision where multiple operators can use their own branding.

## 3. Technical Design

### 3.1 Data Schema
- **Action**: Add a `metadata` JSONB column to the `public.users` table.
- **Content**: `{ "signature_line": "string", "avatar_url": "string" }`.
- **Reasoning**: JSONB allows for future-proofing (storing social links, preferences, etc.) without repeated schema migrations.

### 3.2 UI Component: Settings Page (`src/pages/Settings.jsx`)
- **New Section: My Profile**:
    - **Avatar**: 64px circle with initials. Stylized with `var(--grad-action)`.
    - **Fields**: Inline inputs for `first_name` and `last_name`.
    - **Signature**: Textarea for `signature_line`.
- **Primary Action**: "Save Profile" button (Pink gradient).
- **Secondary Actions**: Existing "Google Calendar" and "Sign Out" moved to a bottom "Account & Technical" group.

### 3.3 Auth Context (`src/context/Auth.jsx`)
- Ensure the `profile` state includes the new `metadata` column.
- Provide a `updateProfile(data)` helper to the context for easy saving.

### 3.4 AI Integration (`api/ai/thank-you-draft.js`)
- Update the logic to fetch the user's signature line from their profile.
- **Rule**: If a `signature_line` exists, automatically append it to the AI-generated draft.

## 4. Hierarchy & Roles
- **Owner (Sandra)**: Manages her own profile and business settings.
- **God Admin (You)**: Manages all businesses.
- **Implementation**: We will respect the existing `role` column in the `users` table for future permission gating.

## 5. Success Criteria
- [ ] Sandra can save her first/last name and signature in Settings.
- [ ] The "Thank You" draft sheet automatically includes her signature at the bottom.
- [ ] The UI remains responsive and follows the Design System (DESIGN.md).
