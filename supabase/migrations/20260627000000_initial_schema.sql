create table boards (
  id bigint primary key generated always as identity,
  name text not null
);

create table columns (
  id bigint primary key generated always as identity,
  board_id bigint not null references boards (id) on delete cascade,
  name text not null,
  position integer not null
);

create table cards (
  id bigint primary key generated always as identity,
  column_id bigint not null references columns (id) on delete cascade,
  name text not null,
  description text,
  position integer not null
);

insert into boards (name) values ('My Board');
