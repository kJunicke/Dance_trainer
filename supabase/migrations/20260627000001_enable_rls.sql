alter table boards enable row level security;
alter table columns enable row level security;
alter table cards enable row level security;

create policy "public read write boards" on boards for all using (true) with check (true);
create policy "public read write columns" on columns for all using (true) with check (true);
create policy "public read write cards" on cards for all using (true) with check (true);
