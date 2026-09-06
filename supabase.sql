-- SHRINE — users + memories, RLS open read, owner write
-- run in supabase SQL editor. no secrets in this file.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,
  created_at timestamptz default now()
);
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  handle text not null,
  city text not null,
  lat double precision not null,
  lng double precision not null,
  line text not null,
  image text not null,
  created_at timestamptz default now()
);
alter table users enable row level security;
alter table memories enable row level security;
drop policy if exists "read all" on memories;
create policy "read all" on memories for select using (true);
drop policy if exists "insert all" on memories;
create policy "insert all" on memories for insert with check (true);
drop policy if exists "read users" on users;
create policy "read users" on users for select using (true);
drop policy if exists "insert users" on users;
create policy "insert users" on users for insert with check (true);
create index if not exists memories_handle_idx on memories(handle);
create index if not exists memories_created_idx on memories(created_at desc);
-- comments: memory_id is text (no fk) so seed memories work too
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  memory_id text not null,
  handle text not null,
  text text not null check (char_length(text) between 1 and 280),
  created_at timestamptz default now()
);
alter table comments enable row level security;
drop policy if exists "read comments" on comments;
create policy "read comments" on comments for select using (true);
drop policy if exists "insert comments" on comments;
create policy "insert comments" on comments for insert with check (true);
create index if not exists comments_memory_idx on comments(memory_id, created_at desc);
-- allow multiple photos per memory
alter table memories add column if not exists images text[] default '{}';
-- reserved handles enforced IN THE DB (client + API can be bypassed by direct anon inserts)
do $$ begin
  alter table users add constraint users_handle_reserved
    check (handle not in ('you','me','yours','mine','my','admin','administrator','shrine','support','help','null','undefined','anonymous','anon','anons','deleted','unknown','everyone','here','channel','official','team','moderator','mod','system','bot','owner'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table memories add constraint memories_handle_reserved
    check (handle not in ('you','me','yours','mine','my','admin','administrator','shrine','support','help','null','undefined','anonymous','anon','anons','deleted','unknown','everyone','here','channel','official','team','moderator','mod','system','bot','owner'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table comments add constraint comments_handle_reserved
    check (handle not in ('you','me','yours','mine','my','admin','administrator','shrine','support','help','null','undefined','anonymous','anon','anons','deleted','unknown','everyone','here','channel','official','team','moderator','mod','system','bot','owner'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table felt add constraint felt_handle_reserved
    check (handle not in ('you','me','yours','mine','my','admin','administrator','shrine','support','help','null','undefined','anonymous','anon','anons','deleted','unknown','everyone','here','channel','official','team','moderator','mod','system','bot','owner'));
exception when duplicate_object then null; end $$;
-- felt: memory_id text (no fk) so seeds work too; one felt per handle per memory
create table if not exists felt (
  memory_id text not null,
  handle text not null,
  created_at timestamptz default now(),
  primary key (memory_id, handle)
);
alter table felt enable row level security;
drop policy if exists "read felt" on felt;
create policy "read felt" on felt for select using (true);
drop policy if exists "insert felt" on felt;
create policy "insert felt" on felt for insert with check (true);
drop policy if exists "delete felt" on felt;
create policy "delete felt" on felt for delete using (true);
create index if not exists felt_memory_idx on felt(memory_id);
-- moderation (day-one minimal): reports + hidden kill switch
-- run in supabase SQL editor. reporters stay private: insert is open, select is NOT
-- (admin reads via service_role key in /api/admin, never the anon key).
alter table memories add column if not exists hidden boolean not null default false;
alter table comments add column if not exists hidden boolean not null default false;
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  memory_id text not null,
  reason text not null check (char_length(reason) between 1 and 40),
  reporter text not null default 'anon',
  created_at timestamptz default now()
);
alter table reports enable row level security;
drop policy if exists "insert reports" on reports;
create policy "insert reports" on reports for insert with check (true);
-- NOTE: no select policy on reports — anon clients cannot list reporters.
create index if not exists reports_memory_idx on reports(memory_id, created_at desc);
