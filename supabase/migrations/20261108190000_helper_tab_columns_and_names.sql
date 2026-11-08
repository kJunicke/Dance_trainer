-- Admins choose a tab's optional columns, and one person keeps one spelling.

create function public.helper_admin_set_columns(
  _pin text,
  _page_id bigint,
  _show_where boolean,
  _show_done boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.helper_require_pin(_pin);

  update public.helper_pages
  set show_where = coalesce(_show_where, true),
      show_done = coalesce(_show_done, false)
  where id = _page_id;

  if not found then
    raise exception 'Tab not found – please reload.';
  end if;
end;
$$;

revoke execute on function public.helper_admin_set_columns(text, bigint, boolean, boolean)
from public, anon, authenticated;
grant execute on function public.helper_admin_set_columns(text, bigint, boolean, boolean)
to anon, authenticated;

-- A trigger rather than a change to helper_signup, so an import is covered too:
-- "conny" signing up next to an existing "Conny" becomes "Conny".
create function public.helper_signup_keep_spelling()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select s.name into new.name
  from (
    select e.name, e.id
    from public.helper_signups e
    where lower(e.name) = lower(new.name)
    union all
    select new.name, null
  ) s
  order by s.id nulls last
  limit 1;
  return new;
end;
$$;

revoke execute on function public.helper_signup_keep_spelling()
from public, anon, authenticated;

create trigger helper_signups_keep_spelling
before insert on public.helper_signups
for each row execute function public.helper_signup_keep_spelling();
