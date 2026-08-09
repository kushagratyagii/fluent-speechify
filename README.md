# Fluent — Speech Therapy Practice

Phase 1 (MVP) of the speech therapy roadmap: a usable app for building a daily
speech practice habit. Frontend only — **no backend and no auth yet**. All data
lives on the device.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
npm test        # vitest, run once
npm run test:watch     # vitest, watch mode
npm run test:coverage  # vitest with coverage report
```

## Testing

Unit and integration tests run on [Vitest](https://vitest.dev) with jsdom and
Testing Library, covering the layers that matter most for correctness:

- `src/utils/__tests__/date.ts` — date-key math, week/day ranges, formatting
- `src/lib/__tests__/gamification.service.test.ts` — XP scaling, leveling, streak
  advance/reset logic
- `src/lib/__tests__/storage.test.ts` — the `localStorage` adapter, including a
  test that data survives a simulated page reload
- `src/lib/__tests__/session-progress-integration.test.ts` — end-to-end:
  completing an exercise correctly updates XP, streak, progress stats and
  today's plan, all through the same repository layer the UI uses

## Loading & error states

- `AppShell` shows a spinner while device storage loads, and a retry screen
  (rather than an infinite spinner) if reading it fails.
- `src/app/error.tsx` and `global-error.tsx` catch unexpected render errors
  per-route and at the root, each with a "try again" action.
- `src/app/not-found.tsx` handles unknown routes.
- `src/app/(app)/loading.tsx` covers route-transition loading.
- Dashboard and Progress show skeleton placeholders (not a blank screen)
  while their data loads.

## What is built

| Roadmap item | Status |
| --- | --- |
| Onboarding: profile (name, age, gender, languages, country) | ✅ |
| Initial assessment: difficulties, severity, situations, goals | ✅ |
| Personalised daily plan generated from the assessment | ✅ |
| Dashboard: streak, today's exercises, minutes, weekly progress, continue session, goal | ✅ |
| 8 interactive exercises with 3 difficulty levels each | ✅ |
| Session summary: duration, exercises completed, streak, XP | ✅ |
| Progress: daily calendar, weekly chart, monthly chart, longest streak, total time | ✅ |
| Gamification: XP, levels, badges, achievements, streak rewards | ✅ |
| Auth (email, Google, reset) | ⛔️ deferred — see *Adding the backend* |
| Supabase persistence | ⛔️ deferred |
| Stammering analysis (FastAPI + ML model, opt-in mic recording in reading/repetition exercises) | 🟡 built, model untrained — see `backend/README.md` |
| Phase 2+ (therapy programs, journal, therapist portal, AI) | ⛔️ not started |

### Exercises

Each one is a real interactive player, not a static description:

1. **Deep Breathing** — animated circle driven by an inhale/hold/exhale pattern that changes per difficulty
2. **Diaphragmatic Breathing** — guided steps with a per-step countdown
3. **Slow Reading** — sentence highlighting at an adjustable words-per-minute pace
4. **Syllable Practice** — Pa/Ta/Ka/Ma/Sa… with a repetition beat indicator
5. **Word Repetition** — multi-syllable words on the same rhythm engine
6. **Mirror Practice** — front camera as a mirror, live only, never recorded
7. **Loud Reading** — stories, quotes, articles and tongue twisters
8. **Relaxation** — jaw, tongue, lip and neck sequences

Three Phase 2 exercises (vowel practice, tongue twisters, conversation practice)
appear in the library as locked previews so the catalogue shape is already right.

## Architecture

The roadmap's key constraint is that the backend must be swappable later
without touching the frontend. That is enforced by a strict layering:

```
UI (app/, features/, components/)
        │           ← never imports storage or a client directly
        ▼
Service layer (lib/services/)          business rules: XP, streaks, plan generation
        │
        ▼
Repository layer (lib/repositories/)   the only place that knows how rows are read
        │
        ▼
Storage adapter (lib/db/storage.ts)    localStorage today, Supabase/REST tomorrow
```

Every repository method is `async` and returns domain types, so replacing the
adapter with a network client is a drop-in change.

```
src/
  app/
    (app)/              routes behind the app shell
      dashboard/  exercises/  exercises/[slug]/
      progress/  achievements/  profile/  session/summary/
    onboarding/
  components/
    layout/             app shell, page header
    ui/                 shadcn/ui + local primitives (choice, button-link)
  features/
    onboarding/ dashboard/ exercises/ session/ progress/ gamification/ profile/
  data/                 exercise catalogue, passages, achievement definitions
  lib/
    db/                 storage adapter + key map
    repositories/       profile, session, plan, gamification
    services/           profile, plan, session, progress, gamification
    validations/        input validation
  hooks/                use-app-data (client bootstrap), use-exercise-timer
  types/                shared domain types
  utils/                date/duration helpers
```

### Notable decisions

- **Wall-clock timer.** `useExerciseTimer` derives elapsed time from
  `Date.now()`, not from counted ticks, so a backgrounded tab (where intervals
  are throttled) still reports the real practice duration.
- **Sessions under 10 seconds are not logged.** Accidental starts should not
  pollute streaks and stats.
- **90% completion marks an exercise done.** Below that the session still earns
  proportional XP but does not tick the daily plan or advance the streak.
- **Plans are deterministic per day.** Exercise scoring is seeded by the date, so
  the plan varies day to day but never reshuffles mid-session.
- **Streaks self-heal.** A streak is only alive if the last practice was today or
  yesterday; a stale one is reset to zero on read.
- **The camera is never recorded.** The mirror exercise attaches the stream to a
  local `<video>` and stops every track on unmount.

## Adding the backend

Nothing above the repository layer needs to change.

1. Add the Supabase client and swap `getStorage()` in `lib/db/storage.ts` for a
   Supabase-backed adapter, or replace each repository body with table queries.
2. The type names in `types/index.ts` already mirror the roadmap's table names
   (`profiles`, `assessments`, `exercises`, `exercise_sessions`, `daily_plans`,
   `streaks`, `achievements`).
3. Replace the hardcoded `profileId: "local"` in the services with the real
   authenticated user id.
4. Wrap the app in auth and drop the onboarding redirect in
   `components/layout/app-shell.tsx` behind a session check.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) ·
Motion · Recharts
