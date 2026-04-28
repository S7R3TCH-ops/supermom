# Real-time Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real-time data refreshing using Supabase Realtime so the UI updates instantly when data changes in the database (e.g., from another device or background process).

**Architecture:**
- Create a centralized Realtime manager to avoid redundant connections.
- Subscribe to `postgres_changes` for `jobs`, `clients`, `payments`, and `expense_log`.
- Filter subscriptions by `business_id` to maintain multi-tenant security/efficiency.
- Trigger the existing `notifyDataChanged()` event on any remote change to leverage current auto-refresh logic.

**Tech Stack:**
- Supabase Realtime
- React (Event-driven refresh)

---

### Task 1: Create Realtime Manager

**Files:**
- Create: `src/data/realtime.js`

- [ ] **Step 1: Implement the Realtime subscription logic**
Create a singleton-style manager that sets up listeners for the core tables.

```javascript
import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';
import { notifyDataChanged } from './useData';

let channel = null;

export async function initRealtime() {
  if (channel) return;

  const businessId = await getCurrentBusinessId();
  if (!businessId) return;

  channel = supabase
    .channel('schema-db-changes')
    // Listen to the 4 core tables Sandra interacts with
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'jobs', filter: `business_id=eq.${businessId}` },
      () => notifyDataChanged()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clients', filter: `business_id=eq.${businessId}` },
      () => notifyDataChanged()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payments', filter: `business_id=eq.${businessId}` },
      () => notifyDataChanged()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expense_log', filter: `business_id=eq.${businessId}` },
      () => notifyDataChanged()
    )
    .subscribe((status) => {
      console.log(`[realtime] Subscription status: ${status}`);
    });
}

export function stopRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add src/data/realtime.js
git commit -m "feat: add real-time subscription manager"
```

### Task 2: Initialize Realtime in the App

**Files:**
- Modify: `src/data/useData.js`

- [ ] **Step 1: Import and trigger initialization**
Update the base data hook or a top-level effect to start the subscription.

```javascript
// Add to imports
import { initRealtime } from './realtime';

// Inside useClients or create a standalone hook
export function useRealtimeSync() {
  useEffect(() => {
    initRealtime();
  }, []);
}
```

- [ ] **Step 2: Wire `useRealtimeSync` into `useClients`**
This ensures that as soon as any main data hook is used, the realtime sync starts.

```javascript
// src/data/useData.js

export function useClients() {
  // ... existing state ...
  
  // Add this line
  useRealtimeSync();

  // ... existing refresh logic ...
}
```

- [ ] **Step 3: Commit**
```bash
git add src/data/useData.js
git commit -m "feat: initialize real-time sync in data hooks"
```

### Task 3: Verification

- [ ] **Step 1: Run build to ensure no breaking changes**
Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 2: Manual Check (Simulation)**
Simulate a remote change by running a Supabase query in the dashboard or via a script, and verify that `notifyDataChanged` (which is already wired to all pages) triggers a re-fetch.
```
```
