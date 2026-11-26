-- EchoID V2 schema. Safe to run more than once in the Supabase SQL editor.
create table if not exists public.echoid_library (
  user_id uuid primary key references auth.users(id) on delete cascade,
  saved jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  playlists jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.echoid_library add column if not exists playlists jsonb not null default '[]'::jsonb;
alter table public.echoid_library enable row level security;
drop policy if exists "Users can read their EchoID library" on public.echoid_library;
create policy "Users can read their EchoID library" on public.echoid_library for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their EchoID library" on public.echoid_library;
create policy "Users can create their EchoID library" on public.echoid_library for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their EchoID library" on public.echoid_library;
create policy "Users can update their EchoID library" on public.echoid_library for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.echoid_library to authenticated;

create table if not exists public.echoid_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  bio text not null default '',
  is_public boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint echoid_profiles_handle_format check (handle ~ '^[a-z0-9_-]{3,30}$')
);
alter table public.echoid_profiles enable row level security;
drop policy if exists "Public profiles are visible to everyone" on public.echoid_profiles;
create policy "Public profiles are visible to everyone" on public.echoid_profiles for select to anon, authenticated using (is_public or (select auth.uid()) = user_id);
drop policy if exists "Users can create their own EchoID profile" on public.echoid_profiles;
create policy "Users can create their own EchoID profile" on public.echoid_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own EchoID profile" on public.echoid_profiles;
create policy "Users can update their own EchoID profile" on public.echoid_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select on public.echoid_profiles to anon, authenticated;
grant insert, update on public.echoid_profiles to authenticated;

create table if not exists public.echoid_public_playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text not null default '',
  tracks jsonb not null default '[]'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint echoid_public_playlists_slug_format check (slug ~ '^[a-z0-9-]{12,64}$')
);
create index if not exists echoid_public_playlists_owner_created_idx on public.echoid_public_playlists(owner_id, created_at desc);
alter table public.echoid_public_playlists enable row level security;
drop policy if exists "Public playlists are visible to everyone" on public.echoid_public_playlists;
create policy "Public playlists are visible to everyone" on public.echoid_public_playlists for select to anon, authenticated using (is_public or (select auth.uid()) = owner_id);
drop policy if exists "Users can publish their own playlists" on public.echoid_public_playlists;
create policy "Users can publish their own playlists" on public.echoid_public_playlists for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Users can update their own public playlists" on public.echoid_public_playlists;
create policy "Users can update their own public playlists" on public.echoid_public_playlists for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "Users can delete their own public playlists" on public.echoid_public_playlists;
create policy "Users can delete their own public playlists" on public.echoid_public_playlists for delete to authenticated using ((select auth.uid()) = owner_id);
grant select on public.echoid_public_playlists to anon, authenticated;
grant insert, update, delete on public.echoid_public_playlists to authenticated;
