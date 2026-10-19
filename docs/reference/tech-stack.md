## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) |
| Styling | CSS custom properties via `tokens.js`, inline `style={{}}` (see DESIGN.md) — corrected 2026-09-17, Tailwind is an unused dependency, zero utility classes in the codebase |
| Auth | Supabase Auth (email/password) |
| Database | Supabase (Postgres) |
| Hosting | Vercel (supermom-s7-r3-tch.vercel.app) |
| Performance | `React.lazy` + `Suspense` code-splitting |
| Calendar | Google Calendar API (OAuth) |
| Maps/Geo | Google Maps API (routing + geofence) |
| State | React Context (no Zustand) |
| AI / LLM | Gemini API (`@google/genai`, model `gemini-3.6-flash`, thinking disabled via `thinkingConfig: { thinkingBudget: 0 }`) — switched from Anthropic 2026-09-22. `GEMINI_API_KEY` env var (must be a Cloud Console-issued, service-account-bound Auth key — see Bugs section for why), `api/_lib/gemini.js` is the shared client/helper. Used by `api/ai/[action].js` (enrich-client, estimate-duration, prep-note, summarize-carried-note, client-brief, day-brief, test-persona) and `api/ai/chat.js`. `@anthropic-ai/sdk` removed from `package.json`. |
