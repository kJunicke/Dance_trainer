-- Per-column flag: where a card created from the practice view's quick-add
-- lands. Practising is the moment new skills get named, and the board isn't
-- reachable mid-session — one inbox column per board collects them until
-- Session Review sorts them into the schedule.
-- `if not exists` because this was applied to the live project by hand before
-- the file was pushed — the auto-deploy on push must be a no-op, not a failure.
alter table columns
  add column if not exists is_inbox_column boolean not null default false;
