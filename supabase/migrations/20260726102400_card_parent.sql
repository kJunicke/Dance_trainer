-- Card → card parent link. Several cards often track subskills of one macro
-- skill (the OFS cards), and the point of relating them is to practise a part
-- in isolation while it is raw, then fold it back into the parent. One parent,
-- arbitrary depth, same board only (enforced in the pickers, not here — RLS
-- already scopes a user to their own boards).
--
-- `on delete set null`, not cascade: deleting a card must never take its parts
-- with it. Both delete and merge reparent children to the grandparent, so a
-- part's own notes and schedule survive its parent going away.
--
-- `name` keeps the leaf only ("Prep", never "OFS - Prep"); the ancestor chain
-- is derived at render time by lib/cardTree.ts. Renaming a parent therefore
-- costs zero writes and can never clobber a hand-edited child name.
--
-- No grants needed: this is an alter on an existing table, and cards already
-- carries the anon/authenticated grants from its own creation migration.
alter table cards
  add column if not exists parent_id bigint references cards(id) on delete set null;

create index if not exists cards_parent_id_idx on cards (parent_id);
