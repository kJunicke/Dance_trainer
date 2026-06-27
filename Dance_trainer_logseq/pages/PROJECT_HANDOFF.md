# Modern Jive Skill Tracker — Rebuild Brief

Rebuild target: Vue + Supabase (Auth + Postgres + RLS + Realtime), multiuser. Focus: Modern Jive
training + documentation tool. v1 was Vue 3 / TS / Pinia / localStorage PWA. This doc = the raw spec.

## 5-Status Learning System (core domain)
| Status | Level | Algorithm | Purpose |
|---|---|---|---|
| backlog | 0 | none | wishlist, no scheduling |
| acquisition | 1–4 | cumulative interval + quality bonus | skill building |
| maintenance | 5+ | SM2 | retention |
| focus | 5+ overlay | daily + XP | intensive improvement |
| archived | 5+ | none | inactive, kept for reference |

Transitions: acquisition→maintenance at L5 (SUGGESTED, not auto). focus↔maintenance user-toggle.
focus→maintenance AUTO after 7 idle days (resumes SR). Levels 0→∞.

## Spaced Repetition Spec
Quality 1–4 everywhere (no 0): 1 Forgotten, 2 Hard, 3 Good, 4 Very Easy.

| Q | Acquisition | Maintenance (SM2) | Focus XP |
|---|---|---|---|
| 1 | reset interval=1 | reset (interval=1,reps=0), ease −0.15 | 0 |
| 2 | +0 days | reset (interval=1,reps=0), ease −0.15 | 1 |
| 3 | +1 day | success, ease −0.02 | 2 |
| 4 | +2 days | success, ease +0.1 | 3 |

Acquisition: new skill interval=0, due today. On practice reps+=1; interval=max(1, interval+bonus)
(or 1 on Q1). Cumulative; new practice reschedules from practice date (overrides remaining days).
INVARIANT: use `interval ?? 0`, never `|| 1` (breaks 0→1 progression).

Maintenance SM2: ease min 1.3 / default 2.5 / max 3.0. Success(Q≥3): reps+=1; interval = 1 (1st),
6 (2nd), else round(interval×ease). Fail(Q<3): interval=1, reps=0.
Smooth acq→maint transition: set reps=2, preserve acquisition interval, ease init so next step never
regresses: minEaseFactor = currentInterval/6 (clamped). Prevents interval drop at L5.

Focus: always due tomorrow. targetXP = floor(6 + level/3) [single source: calculateTargetXP(level),
never hardcode]. readyForLevelUp at 75% of target (ceil(target×0.75)). On levelup: currentXP=0,
recompute target. Track consecutiveGoodSessions (reset on Q<3), totalSessions, lastQuality.

Weekly mode (per-skill): same interval math, but DISPLAYED nextReview rounds forward to next training
day (global config, default Tue/Thu = [2,4]). Stored date stays true. Inactive statuses: nextReview ≈ +10y sentinel.

## Data Model (v1 SkillData)
```
id, name, tags[], level(0..∞), status, notes(markdown), dateCreated, dateModified
spacedRepetitionMode: daily|weekly
SM2: easeFactor(2.5), interval(0), repetitions(0), lastPracticed?, nextReview?
focusData?: { consecutiveGoodSessions, totalSessions, currentXP, targetXP, lastQuality:null, readyForLevelUp }
progressionHistory[]: { level, previousLevel, date, comment, transferredToNotes? }
practiceLog[]: { date, quality, qualityText, note, transferredToNotes?, levelUpInfo?{newLevel,comment} }
quickNotes[]?: { date, note, transferredToNotes? }
```
Tags: Move · Communication · Musicality · Control · Charisma · Leading · Following
Validation: name required ≤100 chars, level ≥ 0.

## Supabase schema (normalized + RLS on auth.uid())
- profiles (1:1 auth.users), user_settings (training_days int[], dark_mode, default_sr_mode)
- skills (core + SM2 + focus_data JSONB + user_id FK)
- practice_sessions (skill_id, user_id, date, quality, note, level_up_info JSONB, transferred_to_notes)
- progression_history (skill_id, user_id, level, previous_level, date, comment, transferred_to_notes)
- quick_notes (skill_id, user_id, date, note, transferred_to_notes)
- Every table: user_id uuid → auth.users; RLS `user_id = auth.uid()` for all CRUD.
- Index next_review per user for "due today". Realtime for cross-device sync.

## Features
Core: skill CRUD, practice rating (Q1–4) with optional inline level-up, per-skill daily/weekly +
global training schedule, auto + suggested status transitions.
Documentation: markdown notes/skill; unified TIMELINE (level-ups + practices + quick notes), one
component → sidebar (compact) + modal (full) via isModalView; filter All→Unmarked→Marked per type
with live counts; inline edit of level-up comments + practice notes; "transferred to notes" check
marking; quick notes (timeline-only, fast capture during practice).
Analytics: training stats, group-by-status, per-skill progress, due-for-review, learning velocity
(level-ups/week over N weeks), stale skills (default 14d threshold).
Platform: PWA offline-first/installable, mobile-first (44px targets), dark mode persisted, toasts
(success/error/warning/info), JSON export/import backup with validation.

## v1 Architecture (keep the good parts)
Service layer + DI: SkillService (CRUD/orchestration), SpacedRepetitionService (algorithm),
TrainingScheduleService (weekly rounding), AnalyticsService, StorageService + StorageAdapter pattern
(LocalStorageAdapter). The adapter interface was built for backend swap → implement SupabaseAdapter,
most logic transfers. Vue 3 Teleport modals via BaseTeleportModal. SkillCard split into 5 sub-components.
Carry forward: centralized XP formula, mandatory `[FALLBACK]` console logging on every defensive
fallback, status-aware fallbacks (`?? 0` vs `|| 1`) as tested invariants, reactive store access (no stale props).

## v1 Shortcomings (why rebuild)
1. localStorage: no multiuser, no sync, single-blob fragility, manual JSON backup → Supabase.
2. Single JSON array forced in-memory re-derivation for timeline/analytics/filtering → normalize.
3. Bootstrap baggage (a whole migration spent escaping modal/CSS conflicts) → lean styling (Tailwind).
4. No real auth/privacy boundary → Supabase Auth + RLS.
5. Ad-hoc runtime migrations (loadAllSkills patching missing fields) → real DB migrations.
6. Algorithm invariants lived in comments → this doc + tested SR module.
7. Mixed German/English user strings → decide i18n up front.

## Rebuild Decisions
Keep: 5-status system + full SR spec (port verbatim w/ tests), service+adapter split,
timeline/documentation model, XP formula, fallback logging, TDD high coverage.
Change/add: Supabase (Auth+RLS+Realtime+migrations+generated types), every query scoped to auth.uid()
(no client-trusted user_id writes), reconsider Bootstrap→Tailwind, i18n from start.
Roadmap (from v1 TODO): goal-setting (short/long-term), milestones/achievements, performance dashboard
(now queryable), E2E (Playwright), MJ-specific: move libraries, partner/figure relationships,
class-vs-social context, shared skill templates between users.

## Quick Reference
```
Quality:     1 Forgotten · 2 Hard · 3 Good · 4 Very Easy
Ease:        min 1.3 · default 2.5 · max 3.0 · +0.1/-0.02/-0.15
SM2 interval: 1 → 6 → round(prev × ease); fail → 1
Acquisition: interval=max(1, interval+{1:reset,2:0,3:+1,4:+2}); start 0, due today
Focus XP:    target=floor(6+level/3); ready at 75%; rewards {1:0,2:1,3:2,4:3}
Transitions: acq→maint @L5 suggested · focus→maint after 7 idle days auto
Weekly:      display-rounds nextReview to next training day (default Tue/Thu=[2,4])
```
