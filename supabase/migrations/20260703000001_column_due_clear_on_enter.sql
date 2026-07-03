-- The on-enter due rule can now also clear a card's due date, not only set it.
-- Mutually exclusive with the set-to-offset rule, and unavailable on a due column.
alter table columns
  add column due_clear_on_enter boolean not null default false,
  add constraint due_clear_excludes_offset
    check (not (due_clear_on_enter and due_offset_days is not null)),
  add constraint due_column_has_no_clear_rule
    check (not (is_due_column and due_clear_on_enter));
