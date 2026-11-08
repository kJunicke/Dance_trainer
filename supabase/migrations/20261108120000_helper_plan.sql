-- Public helper sign-up plan for the dance event (route #/helpers, no accounts).
--
-- Self-contained: nothing here alters or references the Dance Trainer tables.
--
-- The anon key is public, so anon/authenticated may only SELECT the four plan
-- tables. Every write goes through a SECURITY DEFINER function below, which is
-- where the limits, the capacity check and the admin PIN are enforced.
--
-- The repo is public: this file must never contain a PIN or a hash of one. With
-- no helper_admin_secret row every PIN check fails. The team leader sets the PIN
-- once, by hand, in the SQL editor:
--   insert into public.helper_admin_secret (pin_hash)
--   values (extensions.crypt('<a long random pin>', extensions.gen_salt('bf', 10)))
--   on conflict (id) do update set pin_hash = excluded.pin_hash;

create extension if not exists pgcrypto with schema extensions;

-- 1. Tables -------------------------------------------------------------------

create table public.helper_plan (
  id integer primary key default 1 check (id = 1),
  title text not null default '',
  info text not null default ''
);

create table public.helper_pages (
  id bigint primary key generated always as identity,
  name text not null default '',
  position integer not null
);

-- Sections are headings: they have no places, so needed is 0 for them.
create table public.helper_rows (
  id bigint primary key generated always as identity,
  page_id bigint not null references public.helper_pages (id) on delete cascade,
  position integer not null,
  type text not null default 'task' check (type in ('task', 'section')),
  task text not null default '',
  "when" text not null default '',
  "where" text not null default '',
  needed integer not null default 1,
  comment text not null default '',
  constraint helper_rows_needed_check check (
    (type = 'section' and needed = 0) or (type = 'task' and needed between 1 and 50)
  )
);

create index helper_rows_page_id_position_idx on public.helper_rows (page_id, position);

create table public.helper_signups (
  id bigint primary key generated always as identity,
  row_id bigint not null references public.helper_rows (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Also serves as the index for the row_id foreign key.
create unique index helper_signups_row_id_lower_name_key
  on public.helper_signups (row_id, lower(name));

create table public.helper_admin_secret (
  id integer primary key default 1 check (id = 1),
  pin_hash text not null
);

-- 2. RLS and grants -----------------------------------------------------------
-- Supabase's default privileges can hand new tables and functions to anon and
-- authenticated, so everything is revoked explicitly and then granted back.
-- `revoke all` covers insert, update, delete, truncate, references and trigger.

alter table public.helper_plan enable row level security;
alter table public.helper_pages enable row level security;
alter table public.helper_rows enable row level security;
alter table public.helper_signups enable row level security;
alter table public.helper_admin_secret enable row level security;

create policy "helper_plan_select_all" on public.helper_plan
  for select to anon, authenticated using (true);
create policy "helper_pages_select_all" on public.helper_pages
  for select to anon, authenticated using (true);
create policy "helper_rows_select_all" on public.helper_rows
  for select to anon, authenticated using (true);
create policy "helper_signups_select_all" on public.helper_signups
  for select to anon, authenticated using (true);
-- helper_admin_secret: deliberately no policies.

revoke all on table
  public.helper_plan,
  public.helper_pages,
  public.helper_rows,
  public.helper_signups
from public, anon, authenticated;

revoke all on table public.helper_admin_secret
from public, anon, authenticated, service_role;

revoke all on sequence
  public.helper_pages_id_seq,
  public.helper_rows_id_seq,
  public.helper_signups_id_seq
from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on table
  public.helper_plan,
  public.helper_pages,
  public.helper_rows,
  public.helper_signups
to anon, authenticated;

-- 3. Internal helpers (not callable by clients, see the revokes in section 7) -

-- Port of clean() in the prototype: collapses whitespace, optionally keeping line
-- breaks, then truncates. The character class is spelled out so that it matches
-- Unicode spaces (no-break space and friends) independently of the locale.
create function public.helper_clean(_text text, _limit integer, _multiline boolean default false)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- Bounded before the regexes: these run on unauthenticated input.
  _out text := left(coalesce(_text, ''), _limit * 20);
begin
  if _multiline then
    _out := replace(_out, E'\r', '');
    _out := regexp_replace(_out, '[ \t\f\v\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\u001c-\u001f]+', ' ', 'g');
    _out := regexp_replace(_out, ' *\n *', E'\n', 'g');
    _out := btrim(_out, E' \n');
    return rtrim(left(_out, _limit), E' \n');
  end if;

  _out := regexp_replace(_out, '[ \t\n\r\f\v\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\u001c-\u001f]+', ' ', 'g');
  return rtrim(left(btrim(_out, ' '), _limit), ' ');
end;
$$;

-- Invoker rights on purpose: only the SECURITY DEFINER RPCs (running as the
-- owner) can read the secret through this, so a stray grant would not expose it.
create function public.helper_pin_ok(_pin text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  _hash text;
  _ok boolean := false;
begin
  -- Global throttle. The lock lives until the transaction ends, so wrong guesses
  -- are limited to about one per second overall, and callers that lose the race
  -- return at once instead of holding an API connection through the sleep.
  if not pg_try_advisory_xact_lock(7274653) then
    raise exception 'Too many PIN attempts, please try again in a moment.';
  end if;

  select pin_hash into _hash from public.helper_admin_secret where id = 1;

  if _hash is not null and coalesce(_pin, '') <> '' then
    begin
      _ok := extensions.crypt(_pin, _hash) = _hash;
    exception when others then
      -- A malformed stored hash must fail closed, not surface as a server error.
      _ok := false;
    end;
  end if;

  if not _ok then
    perform pg_sleep(1);
  end if;

  return _ok;
end;
$$;

create function public.helper_require_pin(_pin text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.helper_pin_ok(_pin) then
    raise exception 'Wrong admin PIN.';
  end if;
end;
$$;

-- Returns _ids with _id moved by _delta places, clamped at both ends. An id that
-- is no longer in the list (deleted concurrently) leaves the order unchanged.
create function public.helper_reorder(_ids bigint[], _id bigint, _delta integer)
returns bigint[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  _from integer := array_position(_ids, _id);
  _to integer;
  _rest bigint[];
begin
  if _from is null then
    return _ids;
  end if;

  -- bigint so that an absurd _delta clamps instead of overflowing.
  _to := greatest(1, least(cardinality(_ids)::bigint, _from::bigint + coalesce(_delta, 0)));
  if _to = _from then
    return _ids;
  end if;

  _rest := array_remove(_ids, _id);
  return _rest[1:_to - 1] || _id || _rest[_to:cardinality(_rest)];
end;
$$;

-- 4. Guest RPCs ---------------------------------------------------------------

create function public.helper_signup(_row_id bigint, _name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _clean text := public.helper_clean(_name, 40);
  _type text;
  _needed integer;
begin
  if _clean = '' then
    raise exception 'Please enter your name.';
  end if;

  -- The row lock serialises callers per task, so the count below cannot go stale
  -- and two people cannot both take the last place.
  select r.type, r.needed into _type, _needed
  from public.helper_rows r
  where r.id = _row_id
  for update;

  if not found then
    raise exception 'Task not found – please reload.';
  end if;
  if _type <> 'task' then
    raise exception 'This is a heading, not a task.';
  end if;
  if exists (
    select 1 from public.helper_signups s
    where s.row_id = _row_id and lower(s.name) = lower(_clean)
  ) then
    raise exception '% is already in.', _clean;
  end if;
  if (select count(*) from public.helper_signups s where s.row_id = _row_id) >= _needed then
    raise exception 'Somebody was quicker – this task is full now.';
  end if;

  insert into public.helper_signups (row_id, name) values (_row_id, _clean);
end;
$$;

create function public.helper_unsign(_row_id bigint, _name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.helper_rows r where r.id = _row_id) then
    raise exception 'Task not found – please reload.';
  end if;

  -- As in the prototype, removing a name that is already gone is not an error:
  -- two people tapping remove at once both get what they wanted.
  delete from public.helper_signups s
  where s.row_id = _row_id and lower(s.name) = lower(public.helper_clean(_name, 40));
end;
$$;

create function public.helper_set_cell(_row_id bigint, _field text, _value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _type text;
  _clean text;
  _needed integer;
  _count integer;
begin
  if _field is null or _field not in ('task', 'when', 'where', 'needed', 'comment') then
    raise exception 'This field cannot be edited.';
  end if;

  -- Same lock as helper_signup, so needed cannot drop under a concurrent sign-up.
  select r.type into _type
  from public.helper_rows r
  where r.id = _row_id
  for update;

  if not found then
    raise exception 'Task not found – please reload.';
  end if;

  case _field
    when 'task' then
      _clean := public.helper_clean(_value, 500, true);
      if _clean = '' then
        raise exception 'The task cannot be empty.';
      end if;
      update public.helper_rows set task = _clean where id = _row_id;

    when 'when' then
      update public.helper_rows
      set "when" = public.helper_clean(_value, 100)
      where id = _row_id;

    when 'where' then
      update public.helper_rows
      set "where" = public.helper_clean(_value, 200, true)
      where id = _row_id;

    when 'comment' then
      update public.helper_rows
      set comment = public.helper_clean(_value, 1000, true)
      where id = _row_id;

    when 'needed' then
      if _type <> 'task' then
        raise exception 'Only tasks have a number of places.';
      end if;

      -- Digit count is bounded so that the cast below cannot overflow.
      _clean := public.helper_clean(_value, 20);
      if _clean !~ '^[0-9]{1,9}$' then
        raise exception 'Needed must be a whole number from 1 to 50.';
      end if;
      _needed := _clean::integer;
      if _needed not between 1 and 50 then
        raise exception 'Needed must be a whole number from 1 to 50.';
      end if;

      select count(*) into _count from public.helper_signups s where s.row_id = _row_id;
      if _needed < _count then
        raise exception 'Needed cannot go below the % people already signed up.', _count;
      end if;

      update public.helper_rows set needed = _needed where id = _row_id;
  end case;
end;
$$;

-- 5. Admin RPCs: page and plan structure --------------------------------------
-- The PIN is always checked first, so a wrong PIN learns nothing from validation
-- errors. The helper_plan row doubles as the lock for the order of the tabs.

create function public.helper_admin_check(_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.helper_pin_ok(_pin);
end;
$$;

create function public.helper_admin_set_plan(_pin text, _title text, _info text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.helper_require_pin(_pin);

  update public.helper_plan
  set title = coalesce(nullif(public.helper_clean(_title, 200), ''), title),
      info = public.helper_clean(_info, 500)
  where id = 1;
end;
$$;

create function public.helper_admin_add_page(_pin text, _name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  _id bigint;
begin
  perform public.helper_require_pin(_pin);
  perform 1 from public.helper_plan where id = 1 for update;

  insert into public.helper_pages (name, position)
  select
    coalesce(nullif(public.helper_clean(_name, 40), ''), 'NEW'),
    coalesce(max(p.position), 0) + 1
  from public.helper_pages p
  returning id into _id;

  return _id;
end;
$$;

create function public.helper_admin_rename_page(_pin text, _page_id bigint, _name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.helper_require_pin(_pin);

  update public.helper_pages
  set name = coalesce(nullif(public.helper_clean(_name, 40), ''), 'TAB')
  where id = _page_id;

  if not found then
    raise exception 'Tab not found – please reload.';
  end if;
end;
$$;

create function public.helper_admin_delete_page(_pin text, _page_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.helper_require_pin(_pin);
  perform 1 from public.helper_plan where id = 1 for update;

  delete from public.helper_pages where id = _page_id;

  if not found then
    raise exception 'Tab not found – please reload.';
  end if;
end;
$$;

create function public.helper_admin_move_page(_pin text, _page_id bigint, _delta integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _ids bigint[];
begin
  perform public.helper_require_pin(_pin);
  perform 1 from public.helper_plan where id = 1 for update;

  select array_agg(p.id order by p.position, p.id) into _ids from public.helper_pages p;

  if _ids is null or not _page_id = any (_ids) then
    raise exception 'Tab not found – please reload.';
  end if;

  update public.helper_pages p
  set position = u.ord
  from unnest(public.helper_reorder(_ids, _page_id, _delta)) with ordinality as u (id, ord)
  where p.id = u.id and p.position <> u.ord;
end;
$$;

-- 6. Admin RPCs: rows ---------------------------------------------------------
-- The page row is the lock for the order of its rows.

create function public.helper_admin_add_row(
  _pin text,
  _page_id bigint,
  _type text,
  _task text,
  _when text,
  _where text,
  _needed integer,
  _comment text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  _clean_type text := case when _type = 'section' then 'section' else 'task' end;
  _clean_task text;
  _id bigint;
begin
  perform public.helper_require_pin(_pin);
  _clean_task := public.helper_clean(_task, 500, true);

  perform 1 from public.helper_pages where id = _page_id for update;
  if not found then
    raise exception 'Tab not found – please reload.';
  end if;

  if _clean_task = '' then
    raise exception 'The task cannot be empty.';
  end if;

  insert into public.helper_rows (page_id, position, type, task, "when", "where", needed, comment)
  select
    _page_id,
    coalesce(max(r.position), 0) + 1,
    _clean_type,
    _clean_task,
    public.helper_clean(_when, 100),
    public.helper_clean(_where, 200, true),
    case when _clean_type = 'section' then 0 else greatest(1, least(50, coalesce(_needed, 1))) end,
    public.helper_clean(_comment, 1000, true)
  from public.helper_rows r
  where r.page_id = _page_id
  returning id into _id;

  return _id;
end;
$$;

create function public.helper_admin_delete_row(_pin text, _row_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.helper_require_pin(_pin);

  delete from public.helper_rows where id = _row_id;

  if not found then
    raise exception 'Task not found – please reload.';
  end if;
end;
$$;

create function public.helper_admin_move_row(_pin text, _row_id bigint, _delta integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _page_id bigint;
  _ids bigint[];
begin
  perform public.helper_require_pin(_pin);

  select r.page_id into _page_id from public.helper_rows r where r.id = _row_id;
  if not found then
    raise exception 'Task not found – please reload.';
  end if;

  perform 1 from public.helper_pages where id = _page_id for update;

  select array_agg(r.id order by r.position, r.id) into _ids
  from public.helper_rows r
  where r.page_id = _page_id;

  update public.helper_rows r
  set position = u.ord
  from unnest(public.helper_reorder(_ids, _row_id, _delta)) with ordinality as u (id, ord)
  where r.id = u.id and r.position <> u.ord;
end;
$$;

-- Runs in one transaction, so a bad row anywhere rolls back the delete as well.
-- As in the prototype only the first 500 entries are read; the return value is
-- the number of rows actually inserted (rows with an empty task are skipped).
create function public.helper_admin_import_rows(
  _pin text,
  _page_id bigint,
  _rows jsonb,
  _replace boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _item jsonb;
  _position integer;
  _inserted integer := 0;
  _task text;
  _type text;
  _raw_needed text;
  _needed integer;
  _who jsonb;
  _names text[];
  _new_id bigint;
begin
  perform public.helper_require_pin(_pin);

  perform 1 from public.helper_pages where id = _page_id for update;
  if not found then
    raise exception 'Tab not found – please reload.';
  end if;

  if jsonb_typeof(_rows) is distinct from 'array' then
    raise exception 'Invalid import data.';
  end if;

  if coalesce(_replace, false) then
    delete from public.helper_rows where page_id = _page_id;
  end if;

  select coalesce(max(r.position), 0) into _position
  from public.helper_rows r
  where r.page_id = _page_id;

  for _item in
    select e.value
    from jsonb_array_elements(_rows) with ordinality as e (value, ord)
    where e.ord <= 500
    order by e.ord
  loop
    if jsonb_typeof(_item) <> 'object' then
      raise exception 'Invalid import data.';
    end if;

    _task := public.helper_clean(_item ->> 'task', 500, true);
    continue when _task = '';

    _type := case when _item ->> 'type' = 'section' then 'section' else 'task' end;

    _who := _item -> 'who';
    if _who is not null and jsonb_typeof(_who) not in ('array', 'null') then
      raise exception 'Invalid import data: "who" must be a list of names.';
    end if;

    -- Blank names are dropped; the first spelling of a duplicate name wins.
    _names := '{}';
    if _type = 'task' and jsonb_typeof(_who) = 'array' then
      select coalesce(array_agg(d.name order by d.ord), '{}') into _names
      from (
        select distinct on (lower(c.name)) c.name, c.ord
        from (
          select public.helper_clean(w.value, 40) as name, w.ord
          from jsonb_array_elements_text(_who) with ordinality as w (value, ord)
        ) c
        where c.name <> ''
        order by lower(c.name), c.ord
      ) d;
    end if;

    if cardinality(_names) > 50 then
      raise exception 'Too many names on one task (at most 50): %', left(_task, 60);
    end if;

    _raw_needed := nullif(btrim(coalesce(_item ->> 'needed', '')), '');
    if _raw_needed is null then
      _needed := 1;
    elsif _raw_needed ~ '^-?[0-9]{1,9}([.][0-9]+)?$' then
      _needed := trunc(_raw_needed::numeric)::integer;
    else
      raise exception 'Invalid number of places on task: %', left(_task, 60);
    end if;

    _position := _position + 1;

    insert into public.helper_rows (page_id, position, type, task, "when", "where", needed, comment)
    values (
      _page_id,
      _position,
      _type,
      _task,
      public.helper_clean(_item ->> 'when', 100),
      public.helper_clean(_item ->> 'where', 200, true),
      case when _type = 'section' then 0 else greatest(1, least(50, _needed), cardinality(_names)) end,
      public.helper_clean(_item ->> 'comment', 1000, true)
    )
    returning id into _new_id;

    insert into public.helper_signups (row_id, name)
    select _new_id, n.name from unnest(_names) with ordinality as n (name, ord) order by n.ord;

    _inserted := _inserted + 1;
  end loop;

  return _inserted;
end;
$$;

-- 7. Function privileges ------------------------------------------------------
-- Functions are executable by PUBLIC by default, and Supabase's default
-- privileges may also grant them to anon and authenticated.

revoke execute on function
  public.helper_clean(text, integer, boolean),
  public.helper_pin_ok(text),
  public.helper_require_pin(text),
  public.helper_reorder(bigint[], bigint, integer)
from public, anon, authenticated, service_role;

revoke execute on function
  public.helper_signup(bigint, text),
  public.helper_unsign(bigint, text),
  public.helper_set_cell(bigint, text, text),
  public.helper_admin_check(text),
  public.helper_admin_set_plan(text, text, text),
  public.helper_admin_add_page(text, text),
  public.helper_admin_rename_page(text, bigint, text),
  public.helper_admin_delete_page(text, bigint),
  public.helper_admin_move_page(text, bigint, integer),
  public.helper_admin_add_row(text, bigint, text, text, text, text, integer, text),
  public.helper_admin_delete_row(text, bigint),
  public.helper_admin_move_row(text, bigint, integer),
  public.helper_admin_import_rows(text, bigint, jsonb, boolean)
from public, anon, authenticated;

grant execute on function
  public.helper_signup(bigint, text),
  public.helper_unsign(bigint, text),
  public.helper_set_cell(bigint, text, text),
  public.helper_admin_check(text),
  public.helper_admin_set_plan(text, text, text),
  public.helper_admin_add_page(text, text),
  public.helper_admin_rename_page(text, bigint, text),
  public.helper_admin_delete_page(text, bigint),
  public.helper_admin_move_page(text, bigint, integer),
  public.helper_admin_add_row(text, bigint, text, text, text, text, integer, text),
  public.helper_admin_delete_row(text, bigint),
  public.helper_admin_move_row(text, bigint, integer),
  public.helper_admin_import_rows(text, bigint, jsonb, boolean)
to anon, authenticated;

-- 8. Realtime -----------------------------------------------------------------

alter publication supabase_realtime add table
  public.helper_plan,
  public.helper_pages,
  public.helper_rows,
  public.helper_signups;

-- 9. Seed ---------------------------------------------------------------------

insert into public.helper_plan (id, title, info)
values (1, 'DanceFest – To Do''s', 'Find a task that still needs someone and tap „+ Add me“. Thank you!');

insert into public.helper_pages (name, position)
values
  ('BEFORE', 1),
  ('THURSDAY', 2),
  ('PACK LIST', 3),
  ('FOOD LIST', 4),
  ('FRIDAY', 5),
  ('SATURDAY', 6),
  ('SUNDAY', 7),
  ('AFTER', 8);

insert into public.helper_rows (page_id, position, type, task, "when", "where", needed)
select p.id, v.position, v.type, v.task, v.slot, v.place, v.needed
from public.helper_pages p
cross join (
  values
    (1, 'section', 'Set Up (equipment, food)', '17:30–20:00', '', 0),
    (2, 'task', E'Check in area\n(registration paperwork, wristbands, sign the terms, code of conduct to read, colour code for „find dance partner“)', '', 'church-PM', 1),
    (3, 'task', 'Black table cloth & chairs (bar, DJ, adjudication, judges)', '', 'church-PM', 1),
    (4, 'task', E'Judges area\n(black table cloth, German Champs Banner…)', '', 'church-PM', 1),
    (5, 'task', 'Snack area for judges', '', 'church-PM', 1),
    (6, 'task', E'DJ area / music / headset\n(power sockets, printer)', '', 'church-PM', 1),
    (7, 'task', 'Music & headset', '', 'community hall', 1),
    (8, 'task', E'Adjudication area\n(power sockets)', '', 'church-PM', 1),
    (9, 'task', 'Bar area', '', 'church-PM', 1),
    (10, 'task', 'Merchandise area', '', 'church-PM', 1),
    (11, 'task', 'Fans (3)', '', 'church-PM', 1),
    (12, 'task', 'Changing areas', '', 'church-PM, community hall', 1),
    (13, 'task', E'Lights\n(Disco ball and spots, half domes…)', '', 'church-PM, community hall', 1),
    (14, 'section', 'Decoration', '17:30–20:00', '', 0)
) as v (position, type, task, slot, place, needed)
where p.name = 'FRIDAY';
