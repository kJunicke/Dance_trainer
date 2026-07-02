-- Column automation: an on-enter due-date rule, and a per-board "due column"
-- that cards with an arrived due date are swept into on board load.

alter table columns
  add column due_offset_days integer check (due_offset_days >= 0),
  add column is_due_column boolean not null default false,
  add constraint due_column_has_no_enter_rule
    check (not (is_due_column and due_offset_days is not null));

-- At most one due column per board.
create unique index columns_one_due_column_per_board
  on columns (board_id)
  where is_due_column;
