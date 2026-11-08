-- Each tab shows the columns of its sheet: Where and Done can differ per tab, and
-- a task can be ticked off.

alter table public.helper_pages
  add column show_where boolean not null default true,
  add column show_done boolean not null default false;

alter table public.helper_rows
  add column done boolean not null default false;

update public.helper_pages set show_done = true where name in ('THURSDAY', 'FOOD LIST');
update public.helper_pages set show_where = false where name = 'FOOD LIST';

-- Open to guests like every other cell. Headings have nothing to tick off.
create function public.helper_set_done(_row_id bigint, _done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.helper_rows
  set done = coalesce(_done, false)
  where id = _row_id and type = 'task';

  if not found then
    raise exception 'Task not found – please reload.';
  end if;
end;
$$;

revoke execute on function public.helper_set_done(bigint, boolean) from public, anon, authenticated;
grant execute on function public.helper_set_done(bigint, boolean) to anon, authenticated;

-- Same as before, and also reads a task's Done value.
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

    insert into public.helper_rows (page_id, position, type, task, "when", "where", needed, comment, done)
    values (
      _page_id,
      _position,
      _type,
      _task,
      public.helper_clean(_item ->> 'when', 100),
      public.helper_clean(_item ->> 'where', 200, true),
      case when _type = 'section' then 0 else greatest(1, least(50, _needed), cardinality(_names)) end,
      public.helper_clean(_item ->> 'comment', 1000, true),
      _type = 'task' and coalesce(_item ->> 'done' = 'true', false)
    )
    returning id into _new_id;

    insert into public.helper_signups (row_id, name)
    select _new_id, n.name from unnest(_names) with ordinality as n (name, ord) order by n.ord;

    _inserted := _inserted + 1;
  end loop;

  return _inserted;
end;
$$;
