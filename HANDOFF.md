# Handoff: Helper plan → Dance Trainer app

Goal: build a helper sign-up plan for our dance event (DanceFest) as part of the existing
**Dance Trainer** app, which already deploys to GitHub Pages and already has Supabase set up.
This folder contains a working prototype (Python server + one HTML page) that defines the
features, data model and look. Port it; don't reinvent it.

**First step in the new workspace:** look at the Dance Trainer project (stack, routing, how
Supabase is used, how schema changes are made, auth) and **propose a plan to the user before
building anything**. The user explicitly wants to approve plans first.

## Background

- The team plans the event in an Apple Numbers document (screenshot description below).
  Helpers need to see what is still open, put their own name in, and the plan must print nicely.
- Our Nextcloud (team.jive.berlin) has no office editor and the user has no admin rights there,
  so spreadsheets in Nextcloud were ruled out. A laptop-hosted server was considered, then dropped
  in favour of this app (no dependency on a home laptop/internet).
- UI language: **English** (the source document is English; team is in Berlin).

## The source document (Numbers)

- Tabs: **BEFORE, THURSDAY, PACK LIST, FOOD LIST, FRIDAY, SATURDAY, SUNDAY, AFTER**
- Each tab is a table titled e.g. „DanceFest - To Do's FRIDAY“ with columns
  **Task · When · Where · Who · Comment**.
- Bold rows are **section headings** that carry a time slot, e.g. „Set Up (equipment, food)“ 17:30–20:00,
  followed by task rows that usually only have Task + Where.
- Look: amber/orange header row and amber task column, alternating light grey rows.
- FRIDAY content (from the screenshot; the other tabs are still unknown – the user imports them):

| Type | Task | When | Where |
|---|---|---|---|
| section | Set Up (equipment, food) | 17:30–20:00 | |
| task | Check in area (registration paperwork, wristbands, sign the terms, code of conduct to read, colour code for „find dance partner“) | | church-PM |
| task | Black table cloth & chairs (bar, DJ, adjudication, judges) | | church-PM |
| task | Judges area (black table cloth, German Champs Banner…) | | church-PM |
| task | Snack area for judges | | church-PM |
| task | DJ area / music / headset (power sockets, printer) | | church-PM |
| task | Music & headset | | community hall |
| task | Adjudication area (power sockets) | | church-PM |
| task | Bar area | | church-PM |
| task | Merchandise area | | church-PM |
| task | Fans (3) | | church-PM |
| task | Changing areas | | church-PM, community hall |
| task | Lights (Disco ball and spots, half domes…) | | church-PM, community hall |
| section | Decoration | 17:30–20:00 | (rows below were cut off) |

## Features (all implemented in the prototype)

Helpers (no account, no login):
- Tab bar with one tab per day/list; each tab shows a red badge with the number of open places.
- Table per tab: Task · When · Where · Who · Comment. Section rows span the width, bold.
- Each task has **needed** (number of people, default 1). Open tasks get a red left marker,
  full ones green. Counter at the top: „3 open on FRIDAY · 12 open overall“.
- **„+ Add me“** in the Who cell → dialog asks for the name (remembered in localStorage),
  refused if the task just became full or the name is already there.
- Tap a name chip → confirm → remove it.
- Anyone can edit the **comment** of a task.
- **„Only open tasks“** filter: hides covered tasks; a section heading stays only if an open task follows it.
- **Live updates**: other people's sign-ups appear without reload (prototype used SSE; use
  Supabase Realtime), plus a periodic refresh as fallback.
- **Mobile**: under ~760px the table turns into cards (labels „When/Where/Who/Comment“ in front,
  empty fields hidden, section rows become amber headings).

Printing (important requirement):
- Print dialog: **this tab** or **all tabs (each on its own page)**, optionally **only open tasks**.
- Dedicated print markup (not the screen table): A4 landscape, title per page
  „DanceFest – To Do's FRIDAY“, amber header row and task column (`print-color-adjust: exact`),
  header row repeats on each page, rows don't break across pages,
  **one blank handwriting line per open place** in the Who column,
  footer „As of <date> · Sign up online: <URL>“. Ctrl+P without the dialog prints the current tab.

Admin (team only):
- Add / edit / delete / reorder (↑↓) tasks and section headings; edit who + needed directly.
- Add / rename / reorder / delete tabs; edit title and info text.
- **Import from spreadsheet**: user copies cells (Task, When, Where, Who, Comment) in Numbers or
  LibreOffice and pastes them. Parse as TSV with quoted multi-line cells (parser in
  `static/index.html`, `parseTSV`). Skip a header row starting with „Task“. Option (default on):
  rows without Where and Who become section headings. Option: replace tab vs. append.
  Who is split on commas/newlines; needed = max(1, number of names). Shows a preview count.
- Prototype used a shared admin PIN; in the app use whatever auth Dance Trainer already has
  (or Supabase Auth for team members).

## Data model

Prototype (`server.py`, one JSON document):
```
plan  { title, info, version, pages: [page] }
page  { id, name, rows: [row] }           // order matters
row   { id, type: "task"|"section", task, when, where, who: [name], needed, comment }
```
Suggested Supabase tables (prefix them so they never collide with Dance Trainer data;
if one database might hold several events later, add an `events` table and `event_id`):
- `helper_pages (id, name, position)`
- `helper_rows (id, page_id → pages on delete cascade, position, type, task, "when", "where", needed, comment)`
- `helper_signups (id, row_id → rows on delete cascade, name, created_at)` – unique (row_id, lower(name))

Limits used in the prototype: name ≤ 40 chars, task ≤ 500, comment ≤ 1000, where ≤ 200,
needed 1–50; whitespace collapsed (line breaks kept in task/where/comment).

## Security (must get right with an anon key in a public Pages site)

- The anon key is public. **No direct anon INSERT/UPDATE/DELETE on the tables.**
  Anonymous users get SELECT only, plus a few `security definer` RPC functions:
  - `helper_signup(row_id, name)` – checks type = task, capacity (`count < needed`, inside the
    function with a row lock so two people can't take the last place), duplicate name, length.
  - `helper_unsign(row_id, name)`
  - `helper_set_comment(row_id, comment)`
- Everything else only for authenticated team members/admins (RLS).
- Accepted risk (same as a shared spreadsheet): anyone with the link can add/remove names.
  Optional later: a helper access code, rate limiting.
- Ask the user whether the Dance Trainer repo is public (free GitHub Pages requires it) –
  no secrets in the repo; only the anon key.
- Supabase free tier pauses inactive projects; Dance Trainer's normal use probably prevents
  that, but verify before the event.
- Suggest a simple backup/export (e.g. admin button „Download as CSV“) before the event.

## Files in this folder

- `static/index.html` – the full prototype UI: styles (screen, mobile cards, print), rendering,
  dialogs, TSV import parser. Main reference for porting.
- `server.py` – reference for the operations and validation rules (`apply_op`, `make_row`, `seed`).
  Run locally with `python3 server.py` → http://localhost:8080, admin PIN 1234.
- `README.md` – **outdated** (describes laptop hosting); ignore.

Status: API operations tested via curl (sign-up, full-task check, comments, PIN check, import,
reorder, live events). The UI was **never visually checked in a browser** – expect small layout fixes.

## Cleanup after the move (in the Nextcloud workspace, once the user confirms)

- `_Aufraeumen/Helferplan_Test.xlsx` (first spreadsheet attempt)
- this `Helferplan/` folder (keep until the port is done)
- `~/.cache/helferplan-test/` (screenshot test leftovers)
