# Phase 25 Feature Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore 6 core features removed during Phase 25 and fix data-fetching regressions.

**Architecture:** Systematic restoration of logic into `NewJobSheet.jsx` and `Home.jsx` using canonical imports and maintaining ESLint compliance.

**Tech Stack:** React, Supabase, Google Maps API (Proxy).

---

### Task 1: Fix NewJobSheet Data Fetching
**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx`

- [ ] **Step 1: Update useEffect to store jobRows**
Update the mount effect to capture `activeJobs` and store them in a new `jobRows` state.
```javascript
// Add state
const [jobRows, setJobRows] = useState([]);

// Update effect
useEffect(() => {
  let alive = true;
  Promise.all([fetchClients(), fetchActiveJobs()])
    .then(([cs, js]) => { 
      if (alive) { 
        setClientRows(cs);
        setJobRows(js); // Capture the jobs!
      } 
    })
    .catch(console.error);
  return () => { alive = false; };
}, []);
```
- [ ] **Step 2: Verify state population**
Add a temporary log to confirm `jobRows` contains data on mount.
- [ ] **Step 3: Commit**
`git add src/components/sheets/NewJobSheet.jsx && git commit -m \"fix: restore jobRows fetching in NewJobSheet\"`

### Task 2: Restore 3-Step Flow Structure
**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx`

- [ ] **Step 1: Update Step Count and Header**
Change step count from 2 to 3. Add `Step3Review` placeholder.
- [ ] **Step 2: Update Footer Navigation**
Adjust the footer logic to handle the transition to Step 3.
- [ ] **Step 3: Commit**
`git commit -am \"feat: restore 3-step structure in NewJobSheet\"`

### Task 3: Conflict Detection & Playful Confirmation
**Files:**
- Modify: `src/components/sheets/NewJobSheet.jsx`

- [ ] **Step 1: Import findConflicts and update Step 2 logic**
Import `findConflicts` from `../../data/jobsRepo`.
- [ ] **Step 2: Implement Conflict UI in Step 3 Review**
Add the \"Gap vs Drive Time\" visual and the checkbox: \"Taking chances and driving fast? Confirm anyway.\"
- [ ] **Step 3: Implement Validation Guards**
Add `handleBook` validation for all fields and the conflict checkbox.
- [ ] **Step 4: Commit**
`git commit -am \"feat: restore conflict detection and playful confirmation\"`

### Task 4: Restore Live Timer on Home
**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Re-implement LiveTimer sub-component**
Restore the `LiveTimer` component with `setInterval` at bottom of file.
- [ ] **Step 2: Add LiveTimer to HAPPENING NOW card**
Insert `<LiveTimer startTime={activeJob.ai_context.clock_in_time} />` into the active job spotlight.
- [ ] **Step 3: Commit**
`git commit -am \"feat: restore live timer on Home screen\"`

### Task 5: Restore AI Voice Briefing
**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Import AI Voice utilities**
Import `generateCommandBrief`, `speakBrief` from `../data/ai`.
- [ ] **Step 2: Add Read Aloud button**
Restore the button and `isSpeaking` state logic on the MISSION READY card.
- [ ] **Step 3: Commit**
`git commit -am \"feat: restore AI voice briefing\"`

### Task 6: Restore AI Persona Empty States
**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Update EmptyState to use persona**
Pass `persona` to `EmptyState` and restore the message lookup object.
- [ ] **Step 2: Commit**
`git commit -am \"feat: restore persona-specific empty states\"`

