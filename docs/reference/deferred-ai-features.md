### 🤖 AI features (deferred — needs serverless slots)

6. **Voice scheduling** — `transcribe-voice-note` in `api/ai/[action].js` (~line 399) is only a TODO stub (no transcription wired; corrected 2026-09-30, earlier text said it "already exists"). Flow: mic → transcribe → Gemini parses intent → pre-fills NewJobSheet.
7. **Smart scheduling suggestions** — given Sandra's calendar + drive times, Claude suggests optimal day/time for new bookings. All data already available.
8. **Weekly AI debrief** — Sunday evening summary: revenue, hours, top clients, one pattern observation. Extend the daily briefing cron.
9. **Auto-generate prep notes** — based on `ai_context`, pre-draft PrepNoteSheet content before Sandra opens it.
10. **Invoice draft from voice** — 30-second post-job recording → Claude extracts service/duration/extras → pre-fills PostJobSheet.
