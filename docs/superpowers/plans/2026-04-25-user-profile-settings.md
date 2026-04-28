# Sandra's Profile (Item #19) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement user profile settings (First Name, Last Name, Signature) and wire them into AI drafting logic to replace hardcoded "Sandra".

**Architecture:** Extend the `users` table with a `metadata` JSONB column. Update the Settings UI to manage these fields. Update the AI draft API and UI fallbacks to use these personalized fields.

**Tech Stack:** React (Vite), Supabase (PostgreSQL), Anthropic Claude (via Vercel Edge/Serverless function).

---

### Task 1: Database Migration

**Files:**
- Create: `supabase_schema_update_user_profile.sql`

- [ ] **Step 1: Create the migration script**
```sql
-- Add metadata JSONB to users table for signature/preferences
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
```

- [ ] **Step 2: Apply the migration**
Run: `psql $DATABASE_URL -f supabase_schema_update_user_profile.sql` (or use Supabase SQL Editor if local access is unavailable)

- [ ] **Step 3: Update local schema documentation**
Modify `supabase_schema.sql` to include the new column in the `users` table definition.

- [ ] **Step 4: Commit**
```bash
git add supabase_schema.sql
git commit -m "db: add metadata column to users table"
```

---

### Task 2: Settings Page Profile UI

**Files:**
- Modify: `src/pages/Settings.jsx`

- [ ] **Step 1: Add state for profile form**
```javascript
const [form, setForm] = useState({
  first_name: '',
  last_name: '',
  signature: ''
});
const [saving, setSaving] = useState(false);
const [saveMsg, setSaveMsg] = useState(null);
```

- [ ] **Step 2: Initialize form from user profile**
```javascript
useEffect(() => {
  if (profile) {
    setForm({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      signature: profile.metadata?.signature || profile.first_name || ''
    });
  }
}, [profile]);
```

- [ ] **Step 3: Implement save handler**
```javascript
const handleSaveProfile = async () => {
  setSaving(true);
  setSaveMsg(null);
  try {
    const { error } = await supabase
      .from('users')
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        metadata: { ...profile.metadata, signature: form.signature }
      })
      .eq('id', user.id);
    if (error) throw error;
    setSaveMsg({ ok: true, text: 'Profile saved!' });
    // Refreshing profile context would be ideal here if possible
  } catch (e) {
    setSaveMsg({ ok: false, text: e.message });
  } finally {
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 3000);
  }
};
```

- [ ] **Step 4: Add Profile UI section**
Add a new card above the Google Calendar card with inputs for First Name, Last Name, and Signature.

- [ ] **Step 5: Verify UI works and saves to DB**
Manual test: Change name/signature, click save, refresh page, verify values persist.

- [ ] **Step 6: Commit**
```bash
git commit -m "feat: add profile settings UI"
```

---

### Task 3: Personalize AI Draft API

**Files:**
- Modify: `api/ai/thank-you-draft.js`

- [ ] **Step 1: Fetch user profile including metadata**
Update the query to fetch the creator's profile data.
```javascript
const { data: creator, error: creatorErr } = await supabase
  .from('users')
  .select('first_name, metadata')
  .eq('id', job.created_by)
  .single();

const signature = creator?.metadata?.signature || creator?.first_name || 'Sandra';
```

- [ ] **Step 2: Update AI prompt to use signature**
Replace hardcoded "Sandra" in prompts with the `${signature}` variable.
```javascript
prompt = `... from ${signature} (owner of Supermom for Hire) ... Sign off as "${signature}".`;
```

- [ ] **Step 3: Verify API with custom signature**
Test with a job created by a user with a specific signature.

- [ ] **Step 4: Commit**
```bash
git commit -m "feat: personalize AI thank-you drafts with user signature"
```

---

### Task 4: Personalize UI Fallbacks

**Files:**
- Modify: `src/components/sheets/ThankYouDraftSheet.jsx`

- [ ] **Step 1: Get current user profile in sheet**
```javascript
import { useAuth } from '../../context/AuthContext';
const { profile } = useAuth();
const signature = profile?.metadata?.signature || profile?.first_name || 'Sandra';
```

- [ ] **Step 2: Update fallback message logic**
```javascript
const fallback = type === 'receipt' 
  ? `Hi ${clientFirstName || 'there'}, this is ${signature}. Just confirming receipt of your payment. Thank you so much!`
  : `Hi ${clientFirstName || 'there'}, just wanted to say thank you so much for today — it was a pleasure working for you!\n\n- ${signature}`;
```

- [ ] **Step 3: Commit**
```bash
git commit -m "feat: update ThankYouDraftSheet fallbacks to use personalized signature"
```
