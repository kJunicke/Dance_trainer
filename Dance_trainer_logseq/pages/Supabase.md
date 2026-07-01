- GitHub integration configured
	- Pushing to main is supposed to apply new migrations automatically — **but don't trust this blindly**. Migration `20260702000000_fix_label_colors` sat committed on `main` for a day without ever being applied to the live project; nothing in GitHub or Supabase surfaced an error, it just silently didn't run. Always confirm in the dashboard (Database → Migrations) or via the MCP plugin below that a migration you just pushed actually landed, especially before assuming a fix is live
	- [[Tables]]
- To check/apply migrations directly when the auto-deploy is untrustworthy: the `supabase` Claude Code plugin gives an MCP connection straight to the project (`list_migrations`, `apply_migration`, `execute_sql`, etc.)
	- Setup (marketplace isn't preregistered): `claude plugin marketplace add anthropics/claude-plugins-official` then `claude plugin install supabase@claude-plugins-official` — requires a Claude Code session restart to load the new MCP server, then an OAuth login on first use
	- `apply_migration` records the migration under a fresh timestamp version (the moment you run it), not the version in the committed filename — expect the Supabase-side migration history to show a different version number than the git filename for anything applied this way
- Credentials in `Dance_trainer_vue/.env.local` (gitignored, never commit)
- ## Migrations
	- Every migration that creates tables must include explicit GRANTs
	- Tables created via raw SQL do **not** get auto-grants — Supabase UI-created tables do
	- Without grants: Data API shows "API Disabled", all requests return 401
	- Grant template to include in each migration that adds tables:
		- ```sql
		  grant usage on schema public to anon, authenticated;
		  grant all on table <table_name> to anon, authenticated;
		  grant usage, select on all sequences in schema public to anon, authenticated;
		  ```
	- For fixed-value columns (e.g. a label color drawn from a small frontend palette), add a `check (col in (...))` constraint — RLS/grants only gate table/row access, not column *content*, so a client can otherwise insert any string via the Data API even if the UI only offers a dropdown (migration `20260701000000_add_due_dates_and_labels`)
	- When a migration both replaces a `check` constraint and backfills existing rows to satisfy the new one: **drop the old constraint before the backfill UPDATE, not after**. The old constraint is still active mid-transaction until the `drop constraint` statement runs, so an UPDATE writing new values ahead of that will get rejected by the very constraint it's trying to escape (hit this in `20260702000000_fix_label_colors` — an existing row's old-palette color failed the backfill until the drop was reordered first)
-
- ## RLS
	- All tables have RLS enabled
	- Locked down to the authenticated user, scoped to board **membership** (migration `20260629000001_lock_down_rls`) — [[Tables]]
		- Access model: a user can touch a board + its columns/cards only if they have a `board_members` row for it
		- `SECURITY DEFINER` helper functions (`is_board_member`, `owns_board`, `is_column_in_member_board`) do the membership checks — definer bypasses RLS internally, which avoids infinite recursion (a `board_members` policy that reads `board_members`)
		- `boards.created_by` (default `auth.uid()`) lets a freshly created board be visible to its own `INSERT ... RETURNING` before the membership row exists
		- Minimal policy set — only operations the app uses. Omitted until their feature exists: profiles UPDATE, boards rename (UPDATE), board_members leave (DELETE) / sharing INSERT
	- Note: RLS policies control which **rows** a role can access; GRANTs control whether the role can touch the **table** at all — both layers are required
	- For join tables spanning two parents (e.g. `card_labels`, linking a card and a label), checking membership on one side isn't enough — a user who belongs to two boards can otherwise pass a card from Board A alongside a label from Board B, since both individually satisfy "is this mine". `label_matches_card_board()` (migration `20260701000000_add_due_dates_and_labels`) joins both sides and checks they share a `board_id` before the `card_labels` policy allows the row — [[Tables]]
