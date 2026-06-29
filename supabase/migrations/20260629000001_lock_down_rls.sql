-- Lock down RLS: replace the open `using (true)` policies with per-user policies
-- scoped to board membership. Only the policies the current app exercises are
-- created here (no rename/leave/share policies for features that don't exist yet).

-- 1. Drop the open policies ---------------------------------------------------
drop policy "public read write boards" on boards;
drop policy "public read write columns" on columns;
drop policy "public read write cards" on cards;
drop policy "public read write profiles" on profiles;
drop policy "public read write board_members" on board_members;

-- 2. Track the board creator --------------------------------------------------
-- Added before the helper functions because owns_board() references this column
-- (SQL function bodies are validated at creation time). Nullable (no backfill);
-- the default makes a freshly inserted board visible to its own
-- INSERT ... RETURNING before the membership row exists.
alter table boards
  add column created_by uuid default auth.uid() references profiles (id) on delete set null;

-- 3. Helper functions ---------------------------------------------------------
-- SECURITY DEFINER so the internal table reads bypass RLS — this is what
-- prevents infinite recursion (e.g. a board_members policy that reads board_members).
create function public.is_board_member(_board_id bigint)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.board_members
    where board_id = _board_id and user_id = auth.uid()
  );
$$;

create function public.owns_board(_board_id bigint)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.boards
    where id = _board_id and created_by = auth.uid()
  );
$$;

create function public.is_column_in_member_board(_column_id bigint)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.is_board_member(board_id)
  from public.columns
  where id = _column_id;
$$;

-- 4. Policies (authenticated role only) --------------------------------------

-- profiles: a user can read only their own row.
create policy "profiles_select_own" on profiles
  for select to authenticated
  using (auth.uid() = id);

-- boards
create policy "boards_select_member" on boards
  for select to authenticated
  using (created_by = auth.uid() or public.is_board_member(id));

create policy "boards_insert_own" on boards
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "boards_delete_member" on boards
  for delete to authenticated
  using (public.is_board_member(id));

-- board_members: you may only add yourself, and only to a board you created.
create policy "board_members_select_own" on board_members
  for select to authenticated
  using (user_id = auth.uid());

create policy "board_members_insert_self" on board_members
  for insert to authenticated
  with check (user_id = auth.uid() and public.owns_board(board_id));

-- columns: gated by membership of the parent board.
create policy "columns_all_member" on columns
  for all to authenticated
  using (public.is_board_member(board_id))
  with check (public.is_board_member(board_id));

-- cards: gated by membership of the card's column's board.
create policy "cards_all_member" on cards
  for all to authenticated
  using (public.is_column_in_member_board(column_id))
  with check (public.is_column_in_member_board(column_id));
