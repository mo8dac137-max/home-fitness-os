# AGENTS.md

> **POINTER TO SOURCE OF TRUTH**: Full project brief and domain specifications are documented in [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md). Every future task builds on these documents. Never delete or shorten them.

## 3. HARD RULES (must never be broken, even if you see a simpler way)
1. Static client PWA: React + Vite + TypeScript. NO Firebase. NO Node/Express server.
2. Supabase (DB, Auth, RLS, Edge Functions) is the only backend, added in a later task.
3. NO API keys or secrets in the repo or frontend. Gemini is called ONLY through a
   Supabase Edge Function. Send the minimum personal data to any AI.
4. The training engine is deterministic pure TypeScript (@hfos/engine-core): no DOM, no
   Node-only APIs, no network, no third-party runtime deps of its own (it may import
   @hfos/* packages). It runs in the client and in Edge Functions. The app must work
   fully with AI turned off.
5. AI may only rank/select/explain among candidates produced by the engine. It can never
   invent exercises, loads, or rules, and never writes data directly.
6. A Validator stronger than the UI checks every change. User freedom is not a safety
   override. All writes to a plan go through the validator.
7. Events are append-only. Corrections are new "correction" events, never edits.
8. Local-first and offline-capable. Supabase RLS is authoritative for cloud data.
9. npm workspaces (not pnpm). Strict TypeScript. No `any`.
10. All tunable numbers live in @hfos/config as versioned settings, never hard-coded.
11. Do not change this architecture silently. If a rule seems wrong or impossible, stop,
    write the conflict in docs/REPORT_BATCH1.md, and do not improvise.
