- GitHub integration configured
	- Pushing to main applies new migrations automatically
	- [[Tables]]
- Credentials in `Dance_trainer_vue/.env.local` (gitignored, never commit)
	- `VITE_SUPABASE_URL`
	- `VITE_SUPABASE_PUBLISHABLE_KEY` (Supabase now uses publishable keys, not anon keys)
-
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
-
- ## RLS
	- All tables have RLS enabled
	- Currently open policies (`using (true)`) — [[Tables]]
	- TODO: lock down to `auth.uid()` when auth is introduced
	- Note: RLS policies control which **rows** a role can access; GRANTs control whether the role can touch the **table** at all — both layers are required
