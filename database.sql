-- HomeStock v2 — Supabase database
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Home',
  invite_code text unique not null default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  full_name text not null default 'HomeStock User',
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text default '',
  image text default '',
  created_at timestamptz not null default now(),
  unique(household_id, name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text default '',
  color text not null default 'teal',
  created_at timestamptz not null default now(),
  unique(household_id, name)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  room text not null,
  category text not null,
  quantity numeric not null default 0 check (quantity >= 0),
  value numeric not null default 0 check (value >= 0),
  min_quantity numeric not null default 1 check (min_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_name text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- New-user trigger: every new account gets a household and becomes its admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_household uuid;
begin
  insert into public.households(name) values ('My Home') returning id into new_household;
  insert into public.profiles(id, household_id, full_name, role)
  values (new.id, new_household, coalesce(new.raw_user_meta_data->>'full_name', 'HomeStock User'), 'admin');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.my_household_id()
returns uuid language sql stable security definer set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid()
$$;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.categories enable row level security;
alter table public.inventory_items enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households for select using (id = public.my_household_id());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (household_id = public.my_household_id());

-- Profile role/household changes are intentionally not exposed to normal clients.
-- An admin-management RPC can be added later with stricter checks.

drop policy if exists rooms_all on public.rooms;
create policy rooms_all on public.rooms for all using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());

drop policy if exists categories_all on public.categories;
create policy categories_all on public.categories for all using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());

drop policy if exists inventory_all on public.inventory_items;
create policy inventory_all on public.inventory_items for all using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());

drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select using (household_id = public.my_household_id());

drop policy if exists activity_insert on public.activity_log;
create policy activity_insert on public.activity_log for insert with check (household_id = public.my_household_id());

-- Seed rooms/categories only for each new household is intentionally handled by the app.
