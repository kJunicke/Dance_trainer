-- Profiles: public mirror of auth.users (which is not exposed to the Data API).
-- id is both PK and FK to auth.users, so a user deletion cascades here.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text
);

-- Auto-create a profile row on signup, copying relevant info from auth.users.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, new.raw_user_meta_data ->> 'display_name', new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ownership: which users have access to which boards (flat, owner-only for now).
create table board_members (
  board_id bigint not null references boards (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  primary key (board_id, user_id)
);

-- RLS: open for all users for now. TODO: lock down to auth.uid() when auth is wired up.
alter table profiles enable row level security;
alter table board_members enable row level security;

create policy "public read write profiles" on profiles for all using (true) with check (true);
create policy "public read write board_members" on board_members for all using (true) with check (true);

-- Grants: raw-SQL tables don't get auto-grants; without these the Data API returns 401.
grant usage on schema public to anon, authenticated;
grant all on table profiles to anon, authenticated;
grant all on table board_members to anon, authenticated;
