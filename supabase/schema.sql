-- Run this in the Supabase SQL Editor for your EchoID project.
create table if not exists public.echoid_library (
  user_id uuid primary key references auth.users(id) on delete cascade,
  saved jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.echoid_library enable row level security;

drop policy if exists "Users can read their EchoID library" on public.echoid_library;
create policy "Users can read their EchoID library"
  on public.echoid_library for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their EchoID library" on public.echoid_library;
create policy "Users can create their EchoID library"
  on public.echoid_library for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their EchoID library" on public.echoid_library;
create policy "Users can update their EchoID library"
  on public.echoid_library for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.echoid_library to authenticated;
