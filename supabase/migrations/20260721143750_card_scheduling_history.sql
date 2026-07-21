-- Where a card was last scheduled from, and when. Written together whenever a
-- column's on-enter due rule fires (see moveCard in boardStore.ts) — that is
-- the moment the user decides "this went well, it goes in the weekly bucket".
--
-- Stored rather than derived: `due_date - due_offset_days` recovers the entry
-- date exactly, but only while the card still sits in its ladder column. Every
-- card reaching Session Review has been swept into the due column, whose offset
-- is null, so the derivation fails precisely where the information is wanted.
-- Keeping the column id as well as the date also keeps old cards honest if a
-- column's interval is edited later.
--
-- No grants needed: this is an alter on an existing table, and cards already
-- carries the anon/authenticated grants from its own creation migration.
-- `if not exists` because this was applied to the live project during
-- development; the push-to-main run must be a no-op rather than an error.
--
-- The 20260721143750 stamp is deliberate and must not be "tidied" to a round
-- number. That is the version the development apply recorded in the remote
-- migration history, and `supabase db push` refuses to insert a local file
-- that sorts *before* the last applied migration. Naming the file anything
-- earlier makes the GitHub deploy fail on every subsequent push, not just this
-- one.
alter table cards
  add column if not exists last_scheduled_column_id bigint references columns(id) on delete set null,
  add column if not exists last_practiced_on date;
