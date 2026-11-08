-- Admins choose which columns a tab has: When, Where, Done and Comment can be
-- switched off (the values stay), and custom text columns can be added and deleted.

alter table public.helper_pages
  add column show_when boolean not null default true,
  add column show_comment boolean not null default true,
  add column custom_columns jsonb not null default '[]'::jsonb;

alter table public.helper_rows
  add column extra jsonb not null default '{}'::jsonb;

update public.helper_pages set show_when = false where name = 'FOOD LIST';

-- Replaced by the per-column toggle below: two admins switching different columns
-- must not overwrite each other from a stale screen.
drop function public.helper_admin_set_columns(text, bigint, boolean, boolean);

-- Keeps only the columns that exist on the tab, and drops empty values.
create function public.helper_clean_extra(_columns jsonb, _values jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(c.value ->> 'id', v.cleaned), '{}'::jsonb)
  from jsonb_array_elements(coalesce(_columns, '[]'::jsonb)) as c (value)
  cross join lateral (
    select public.helper_clean(_values ->> (c.value ->> 'id'), 1000, true) as cleaned
  ) v
  where v.cleaned <> '';
$$;

-- The page is locked before the row, the order helper_admin_delete_column uses,
-- so a value can't land in a column that is being deleted.
create function public.helper_set_extra(_row_id bigint, _column_id text, _value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _page_id bigint;
  _columns jsonb;
  _clean text := public.helper_clean(_value, 1000, true);
begin
  select r.page_id into _page_id from public.helper_rows r where r.id = _row_id;
  if not found then
    raise exception 'Task not found – please reload.';
  end if;

  select p.custom_columns into _columns
  from public.helper_pages p
  where p.id = _page_id
  for share;

  perform 1 from public.helper_rows r where r.id = _row_id for update;
  if not found then
    raise exception 'Task not found – please reload.';
  end if;

  if _column_id is null or not exists (
    select 1 from jsonb_array_elements(_columns) as c (value) where c.value ->> 'id' = _column_id
  ) then
    raise exception 'This column no longer exists – please reload.';
  end if;

  update public.helper_rows
  set extra = case
    when _clean = '' then extra - _column_id
    else extra || jsonb_build_object(_column_id, _clean)
  end
  where id = _row_id;
end;
$$;

create function public.helper_admin_set_column_shown(
  _pin text,
  _page_id bigint,
  _column text,
  _shown boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.helper_require_pin(_pin);

  if _column is null or _column not in ('when', 'where', 'done', 'comment') then
    raise exception 'This column cannot be switched off.';
  end if;

  update public.helper_pages
  set show_when = case when _column = 'when' then coalesce(_shown, true) else show_when end,
      show_where = case when _column = 'where' then coalesce(_shown, true) else show_where end,
      show_done = case when _column = 'done' then coalesce(_shown, false) else show_done end,
      show_comment = case when _column = 'comment' then coalesce(_shown, true) else show_comment end
  where id = _page_id;

  if not found then
    raise exception 'Tab not found – please reload.';
  end if;
end;
$$;

-- The built-in names are refused even while hidden: import matches columns by
-- their heading, so "Comment" has to keep meaning the Comment column.
create function public.helper_admin_add_column(_pin text, _page_id bigint, _name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _clean text;
  _columns jsonb;
  _id text := 'c' || left(replace(gen_random_uuid()::text, '-', ''), 12);
begin
  perform public.helper_require_pin(_pin);
  _clean := public.helper_clean(_name, 40);

  select p.custom_columns into _columns
  from public.helper_pages p
  where p.id = _page_id
  for update;
  if not found then
    raise exception 'Tab not found – please reload.';
  end if;

  if _clean = '' then
    raise exception 'Please give the column a name.';
  end if;
  if lower(_clean) in ('task', 'when', 'where', 'who', 'done', 'comment', 'needed', 'type', 'tab') then
    raise exception '% is already a column name, please pick another.', _clean;
  end if;
  if exists (
    select 1 from jsonb_array_elements(_columns) as c (value)
    where lower(c.value ->> 'name') = lower(_clean)
  ) then
    raise exception 'This tab already has a column called %.', _clean;
  end if;
  if jsonb_array_length(_columns) >= 10 then
    raise exception 'A tab can have at most 10 extra columns.';
  end if;

  update public.helper_pages
  set custom_columns = _columns || jsonb_build_array(jsonb_build_object('id', _id, 'name', _clean))
  where id = _page_id;

  return _id;
end;
$$;

create function public.helper_admin_delete_column(_pin text, _page_id bigint, _column_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _columns jsonb;
begin
  perform public.helper_require_pin(_pin);

  select p.custom_columns into _columns
  from public.helper_pages p
  where p.id = _page_id
  for update;
  if not found then
    raise exception 'Tab not found – please reload.';
  end if;

  if _column_id is null or not exists (
    select 1 from jsonb_array_elements(_columns) as c (value) where c.value ->> 'id' = _column_id
  ) then
    raise exception 'This column no longer exists – please reload.';
  end if;

  update public.helper_pages p
  set custom_columns = (
    select coalesce(jsonb_agg(c.value order by c.ord), '[]'::jsonb)
    from jsonb_array_elements(_columns) with ordinality as c (value, ord)
    where c.value ->> 'id' <> _column_id
  )
  where p.id = _page_id;

  update public.helper_rows r
  set extra = r.extra - _column_id
  where r.page_id = _page_id and r.extra ? _column_id;
end;
$$;

-- An overload rather than a replacement, so a page still open on the old build
-- can keep adding rows.
create function public.helper_admin_add_row(
  _pin text,
  _page_id bigint,
  _type text,
  _task text,
  _when text,
  _where text,
  _needed integer,
  _comment text,
  _extra jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  _id bigint := public.helper_admin_add_row(_pin, _page_id, _type, _task, _when, _where, _needed, _comment);
begin
  update public.helper_rows r
  set extra = public.helper_clean_extra(p.custom_columns, _extra)
  from public.helper_pages p
  where r.id = _id and p.id = r.page_id;

  return _id;
end;
$$;

revoke execute on function public.helper_clean_extra(jsonb, jsonb)
from public, anon, authenticated, service_role;

revoke execute on function
  public.helper_set_extra(bigint, text, text),
  public.helper_admin_set_column_shown(text, bigint, text, boolean),
  public.helper_admin_add_column(text, bigint, text),
  public.helper_admin_delete_column(text, bigint, text),
  public.helper_admin_add_row(text, bigint, text, text, text, text, integer, text, jsonb)
from public, anon, authenticated;

grant execute on function
  public.helper_set_extra(bigint, text, text),
  public.helper_admin_set_column_shown(text, bigint, text, boolean),
  public.helper_admin_add_column(text, bigint, text),
  public.helper_admin_delete_column(text, bigint, text),
  public.helper_admin_add_row(text, bigint, text, text, text, text, integer, text, jsonb)
to anon, authenticated;

-- Same as before, and also stores the tab's custom column values.
create or replace function public.helper_admin_import_rows(
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
  _columns jsonb;
begin
  perform public.helper_require_pin(_pin);

  select p.custom_columns into _columns from public.helper_pages p where p.id = _page_id for update;
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

    insert into public.helper_rows (page_id, position, type, task, "when", "where", needed, comment, done, extra)
    values (
      _page_id,
      _position,
      _type,
      _task,
      public.helper_clean(_item ->> 'when', 100),
      public.helper_clean(_item ->> 'where', 200, true),
      case when _type = 'section' then 0 else greatest(1, least(50, _needed), cardinality(_names)) end,
      public.helper_clean(_item ->> 'comment', 1000, true),
      _type = 'task' and coalesce(_item ->> 'done' = 'true', false),
      public.helper_clean_extra(_columns, _item -> 'extra')
    )
    returning id into _new_id;

    insert into public.helper_signups (row_id, name)
    select _new_id, n.name from unnest(_names) with ordinality as n (name, ord) order by n.ord;

    _inserted := _inserted + 1;
  end loop;

  return _inserted;
end;
$$;
