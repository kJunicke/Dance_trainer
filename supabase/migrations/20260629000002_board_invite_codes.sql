-- Per-board invite codes + a join-by-code flow for multi-user access.

-- Unguessable, unique code per board. The volatile default fills existing rows
-- each with their own code (no backfill needed).
alter table boards add column invite_code uuid not null default gen_random_uuid();
create unique index boards_invite_code_key on boards (invite_code);

-- join_board: any authenticated user who has a board's code adds *themselves* as
-- a member. SECURITY DEFINER bypasses the restrictive board_members INSERT policy;
-- auth.uid() inside it still resolves to the caller, so you can only add yourself.
create function public.join_board(_invite_code uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  _board_id bigint;
begin
  select id into _board_id from public.boards where invite_code = _invite_code;
  if _board_id is null then
    raise exception 'invalid invite code';
  end if;
  insert into public.board_members (board_id, user_id)
  values (_board_id, auth.uid())
  on conflict do nothing;
  return _board_id;
end;
$$;
