-- Add due dates on cards, and colored labels assignable to multiple cards.

alter table cards add column due_date date;

create table labels (
  id bigint primary key generated always as identity,
  board_id bigint not null references boards (id) on delete cascade,
  name text not null,
  color text not null check (color in ('green', 'yellow', 'red', 'purple', 'blue', 'sky'))
);

create table card_labels (
  card_id bigint not null references cards (id) on delete cascade,
  label_id bigint not null references labels (id) on delete cascade,
  primary key (card_id, label_id)
);

-- Grants: required for the Data API, tables created via SQL don't get them automatically.
grant all on table labels to anon, authenticated;
grant all on table card_labels to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- RLS, mirroring the board-membership gating in 20260629000001_lock_down_rls.sql.
alter table labels enable row level security;
alter table card_labels enable row level security;

create function public.is_card_in_member_board(_card_id bigint)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.is_column_in_member_board(column_id)
  from public.cards
  where id = _card_id;
$$;

-- Prevents attaching a label from one board to a card on a different board
-- (a user who's a member of both boards would otherwise pass is_card_in_member_board
-- alone, since that only checks the card's board, not the label's).
create function public.label_matches_card_board(_card_id bigint, _label_id bigint)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.cards c
    join public.columns col on col.id = c.column_id
    join public.labels l on l.id = _label_id
    where c.id = _card_id and l.board_id = col.board_id
  );
$$;

create policy "labels_all_member" on labels
  for all to authenticated
  using (public.is_board_member(board_id))
  with check (public.is_board_member(board_id));

create policy "card_labels_all_member" on card_labels
  for all to authenticated
  using (public.is_card_in_member_board(card_id) and public.label_matches_card_board(card_id, label_id))
  with check (public.is_card_in_member_board(card_id) and public.label_matches_card_board(card_id, label_id));
