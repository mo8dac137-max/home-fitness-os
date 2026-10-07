# HOME FITNESS OS — PROJECT BRIEF (source of truth for every future task)

You are the primary builder of "Home Fitness OS". Read this whole brief first.
Save it verbatim as docs/PROJECT_BRIEF.md. Create AGENTS.md at the repo root containing
section 3 (HARD RULES) plus a pointer to docs/PROJECT_BRIEF.md. Every future task builds
on these two files, so never delete or shorten them.

## 1. PRODUCT
A personal, single-user, installable Android PWA (target phone: Redmi 12, mid-range),
offline-first, for HOME workouts only. Bodyweight first; equipment (dumbbells, bands,
pull-up bar) may be added later without rebuilding the system. Dark, data-rich UI with
many editable settings. A future "Hub" app will supply schedule constraints. UI language is
undecided (Arabic RTL is likely): all user-facing strings must be keyed (i18n-ready).
Use a Mock User for all tests; never store real personal data in the repo.

## 2. TRAINING GOALS (drive the engine)
Priority order: strength > muscle > endurance/mobility. Body recomposition, never
aggressive weight loss. Physique priorities (user-rankable, max two HIGH): shoulders,
back, chest, arms, abs, hip mobility, strong/mobile/enduring legs.

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

## 4. DOMAIN CONCEPTS
Exercise (stable id, pattern, muscles, level, equipment requirement expression
all/any, progression/regression links, safety flags, type compound/accessory/mobility/
conditioning, asset status). Movement patterns: horizontal_push, vertical_push,
horizontal_pull, vertical_pull, squat, hinge, lunge, core, mobility, conditioning.
EnvironmentState per item: unknown -> declared -> validated(date) -> retired; unsafe items
(table, door, stairs) are ineligible until the user validates them. Session with an
immutable PrescriptionSnapshot (exercises, sets, reps, rest, rules, engine/config versions).
Plan = 7 days (Day 0 locked, Day 1 protected, Day 2-6 adaptive) of PlanDay (main, micro,
flex, active_recovery, rest). TrainingUnit (A/B/C/D): the engine picks the next unit, no fixed
calendar. ChangeRequest (source manual|quick|ai) with commands make_harder, make_easier,
replace_exercise, increase_muscle_focus, shorten_session; ChangeProposal shows the diff and
waits for approval according to an autonomy matrix (ask/notify/auto per decision class).
Validator pipeline: schema -> environment -> safety -> recovery/spacing -> volume ->
duration -> goal alignment -> accepted | accepted_with_warning | rejected (+ nearest valid
alternative). DecisionRecord (provenance): candidates, term values, filters, selection.
KnowledgeFact (declared|measured|inferred, confidence, updated_at, expiry) and
InformationNeed (reason, consumer, priority, expiry): ask the user only when a decision
needs it. Progression review outcomes: progress | maintain | regress | deload |
insufficient_data. Estimated values (muscle contribution, readiness) are always labeled
estimates; never show a trend without minimum data.

## 5. KEY RULES AND DEFAULTS (all become settings)
execution_horizon_days 7 (3-8); minimum main session 30 min (safety-locked); transition 15 s
(10-30), rest is dynamic per exercise/goal; hysteresis 0.10 with a material-change test
(exercise set changed, >=10% duration, >=10% hard sets, or pattern focus changed);
rank_score = hard filters first, then weighted sum: priority_need 0.20, stimulus_gap 0.20,
progression_need 0.20, goal_weight 0.15, schedule_fit 0.15, readiness 0.10; progression
review after >=3 main sessions and >=6 days (max 10 days); day_start_hour 4.

## 6. SAFETY AND HONESTY
No medical claims. No spot-reduction claims. No weight-loss default. Pain flag reduces load
and explains why. Never claim precision the data cannot support.

## 7. NOT NOW
No real UI beyond a placeholder, no Supabase, no AI calls, no auth, no Hub, no animation.
