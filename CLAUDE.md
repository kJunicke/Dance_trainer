# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Goal
Powerful Skill tracker for dance training, that documents progress for individual skills and keeps track of what skills need to be practiced when using spaced repetition.

Scheduling is a **Leitner box, not SM2** — per-column `due_offset_days` + `sweepDueCards()`, with the user picking the destination column after practising. There is no ease factor, interval or repetition count anywhere, and adding SM2 was explicitly declined on 2026-07-21. `Dance_trainer_logseq/pages/PROJECT_HANDOFF.md` is a superseded spec that describes an SM2 system which was never built — don't implement from it.

## Functionality
- Clean, intuitive, and unrestrictive design
- Based on Kanban boards
- Multi-user support
- Mobile-first approach

# Architecture
- Supabase backend, Vue frontend
- Repo layout: `Dance_trainer_vue/` (the app — `src/stores`, `src/router`, `src/views`, `src/components`, `src/lib` for the Supabase client), `supabase/migrations/` (SQL migrations, repo root — not inside the Vue app), `Dance_trainer_logseq/` (docs)

# Commands
Run from `Dance_trainer_vue/`:
- `npm run dev` — dev server, is running most of the time already
- `npm run build` — type-check + production build
- `npm run type-check` — `vue-tsc` only
- `npm run lint` — oxlint + eslint, both with `--fix`
- `npm run format` — prettier on `src/`
- No test suite exists yet. Verify changes via type-check and manual run (see the `/run` or `/verify` skill).

# Vue Patterns
- **Multi-argument events**: `$event` in inline template handlers is only the first argument. Use arrow functions for events that emit multiple args: `@rename-card="(id, name) => store.renameCard(id, name)"`
- **Optimistic updates**: In store actions, update local state first, then persist to DB, and revert on error. Never wait for the DB round-trip before updating the UI.

# Deployment
- App is served under `/Dance_trainer/` on GitHub Pages but `/` in local dev (see `base` in vite.config.ts). The PWA manifest's `scope`/`start_url` must stay derived from `base` — don't hardcode them, or the installed PWA will break in production while testing fine locally.

# Docs (Logseq wiki)
Docs live in [Logseq](Dance_trainer_logseq) and work as a project wiki, not a file dump: `pages/`
holds durable knowledge, `journals/` is the chronological build log, `contents.md` is the index.
The codebase and git history are the source of truth — the wiki is a synthesized, cross-linked
layer on top, so it answers "why/how does X work" without re-deriving it from a diff every time.

## Ingest — before every commit (per the Github rule below), plus mid-session for undocumented decisions
- Update any `pages/` entries the change touches: schema fields, feature behavior, invariants,
  gotchas. Link related pages with `[[Page Name]]`.
- Append an entry to today's journal (`journals/YYYY_MM_DD.md`), one line per unit of work, tagged
  `[feature]`, `[fix]`, `[decision]`, or `[doc]`, linking to any pages it touches, e.g.
  `- [fix] Card drag always dropped at column end — [[Tables]]`. TODO/DONE blocks keep their
  existing untagged format so Logseq still recognizes them as tasks.
- Update `contents.md`: one line per page — link, one-line summary, category (Schema / Backend /
  Feature / Spec).

## Query
- Before starting work, check `contents.md` and relevant pages for prior context — don't
  rediscover a decision that's already recorded.
- Read `contents.md` first and only open the page(s) its summaries point to — don't grep/read
  every page for a normal question. Grep everything only for structural passes (e.g. a lint pass)
  that genuinely need full coverage. For journals, grep by `[tag]` or date instead of reading each
  day file.
- If a conversation produces a non-trivial synthesis not yet captured (a design decision, a
  tradeoff, an architecture rationale), file it into the relevant page rather than leaving it
  stranded in chat history.

## Conventions
- Logseq markdown: bullet outlines and `[[links]]`, not prose Obsidian-style pages.
- Flag TODOs with the `TODO` keyword so they surface as Logseq tasks.
- Wiki health checks (orphan pages, stale/contradicted claims, missing cross-links) are on-request
  only — ask if the wiki needs a lint pass, don't run one automatically.

# Supabase
- Github is connected to Supabase. Migrations will get pushed to Supabase automatically when they are pushed to main. Use this as the main way to apply migrations
- **Every migration that creates tables must also GRANT access to `anon` and `authenticated` roles.** Tables created via raw SQL (not the Supabase UI) don't get auto-grants — the Data API will show "API Disabled" and return 401 until grants are added. See [Supabase.md](Dance_trainer_logseq/pages/Supabase.md) for the grant template.
- Credentials live in `Dance_trainer_vue/.env.local` (gitignored). Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`


# Github
- is connected to remote repo Dance_trainer
- always commit everything that has changed even if you didn't make the changes. Look at the diff and include them in your commit message
- update the version number rendered in the header of the board selection view with every push
- Before every commit update all relevant docs in logseq

# Testing
- I've installed a phone simulator browser extension. I can open it up when you have browser access to let you test it on a proper screen

# General guidelines
- be brief 
- be efficient
- before any changes always check logseq for relevant context
- be direct and honest

# Coding Guidelines
1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
