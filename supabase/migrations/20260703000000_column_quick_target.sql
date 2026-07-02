-- Per-column flag: show a one-tap "quick move" button in the card modal that
-- sends the card straight to this column.
alter table columns
  add column is_quick_target boolean not null default false;
