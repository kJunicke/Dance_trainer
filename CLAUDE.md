# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Goal
Powerful Skill tracker for dance training, that documents progress for individual skills and keeps track of what skills need to be practiced when using spaced repetition.

Scheduling is a **Leitner box, not SM2** — per-column `due_offset_days` + `sweepDueCards()`, with the user picking the destination column after practising. There is no ease factor, interval or repetition count anywhere, and adding SM2 was explicitly declined on 2026-07-21. `Dance_trainer_logseq/pages/archive/PROJECT_HANDOFF.md` is a superseded spec that describes an SM2 system which was never built — don't implement from it. Nothing in `pages/archive/` is a description of the app as it is.

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
holds durable knowledge, `journals/` is a dated record of decisions and rejected alternatives (not
a changelog — git is the changelog), `contents.md` is the index.
The codebase and git history are the source of truth — the wiki is a synthesized, cross-linked
layer on top, so it answers "why/how does X work" without re-deriving it from a diff every time.

## Where knowledge lives — four homes, don't duplicate between them
- **The wiki** (`Dance_trainer_logseq/`) — how and why the app works. Start at `pages/contents.md`,
  whose **Code map** section routes from a source file to the page that governs it. `pages/Open Work.md`
  is the single list of everything deferred; `pages/archive/` holds superseded records, which stay
  readable but must never be built from.
- **This file** — commands, hard rules, and the traps that must be known before reading anything else.
- **[PRODUCT.md](PRODUCT.md)** — who the user is, what the product is for, brand personality,
  design principles, and the directions explicitly rejected. Read it before any UX or product
  judgment call; don't restate it in the wiki.
- **[DESIGN.md](DESIGN.md)** — the concrete visual system: every token, the type scale, radii, the
  card status rail, and the named rules that govern them. Read it before any styling work.
  `src/assets/tokens.css` stays authoritative for raw values and the wiki holds the reasoning
  behind them, so when a token or convention changes, update DESIGN.md in the same commit — it has
  drifted from the code before. `.impeccable/design.json` is its machine-readable sidecar
  (tonal ramps, shadows, motion, component snippets); regenerate both together via
  `/impeccable document`.

## Ingest — before every commit (per the Github rule below), plus mid-session for undocumented decisions
- **The page is the deliverable.** Update any `pages/` entries the change touches: schema fields,
  feature behavior, invariants, gotchas. Link related pages with `[[Page Name]]`. A page reads as
  *current state and why it's that way* — never as a dated changelog. Don't append "on 2026-07-21 we
  did X"; fold the outcome into the claim it changes, correcting the old text in place.
- **Journal decisions only** (`journals/YYYY_MM_DD.md`), one line, tagged `[decision]`, linking to the
  page that holds the reasoning. Git records what was built and the pages record how it works — the
  journal exists for what neither can hold: **the alternative that was considered and rejected, and
  what it would have cost.** A rejected option leaves no commit and no code, and it is the thing
  most likely to be re-proposed in six months.
  - `- [decision] Rejected Obsidian-style live preview (CodeMirror 6, ~1–2 weeks, weakest on touch) — [[Card Notes]]`
  - Do **not** journal `[feature]`/`[fix]`/`[doc]` lines. Git log already holds them at a better
    grain, and a third copy of a fact that's already in a commit message and on a page just drifts.
    Older journals still carry those tags; leave them, don't backfill or rewrite them.
- **A journalled decision must also land on its page**, in the section it constrains (the
  "Decided against" pattern in `pages/archive/UX Batches 2026-07.md` is the model). The journal is a
  dated index into those, never their only home — an entry whose page doesn't contain the decision
  is the failure this rule exists to prevent.
- Update `contents.md`: one line per page — link, one-line summary, category (Schema / Backend /
  Feature / Review). Keep its **Code map** accurate: a new page, or a new source file/directory,
  means a new routing line.
- Deferring something? It goes in `pages/Open Work.md`, not as a `TODO` on a feature page. Keep the
  *reasoning* on the topic page and the *task* in Open Work, linked both ways.

## Query
- Before starting work, check `contents.md` and relevant pages for prior context — don't
  rediscover a decision that's already recorded.
- Read `contents.md` first and only open the page(s) its summaries point to — don't grep/read
  every page for a normal question. Grep everything only for structural passes (e.g. a lint pass)
  that genuinely need full coverage.
- Before proposing a rewrite, a library, or a different architecture, `grep -rn '\[decision\]'
  Dance_trainer_logseq/journals` — it's a short list, and it's where you find out the idea was
  already costed and rejected. For "what changed and when", use `git log`, not the journals.
- If a conversation produces a non-trivial synthesis not yet captured (a design decision, a
  tradeoff, an architecture rationale), file it into the relevant page rather than leaving it
  stranded in chat history.

## Conventions
- Logseq markdown: bullet outlines and `[[links]]`, not prose Obsidian-style pages.
- Flag TODOs with the `TODO` keyword so they surface as Logseq tasks — in `Open Work.md`, which is
  where they belong.
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
- **Always use "Test board" for browser testing** — never the real boards (JuKi practise, NeKi). Their cards are real training data.
- I've installed a phone simulator browser extension. I can open it up when you have browser access to let you test it on a proper screen

# General guidelines
- be extremly consize. Sacrifice Grammar for consizeness 
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
