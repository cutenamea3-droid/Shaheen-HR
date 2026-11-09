-- HR Personal — Personal-only schema (DO NOT run on Driver or Admin projects)
-- Apply only to a dedicated Personal Supabase project after explicit user approval.
-- Tables: personal_profiles, personal_study_state
-- Never touches company app_state, tracker_sections, attendance, payroll, banking, drug tests, rate cards.

-- Profiles (1:1 with auth.users)
create table if not exists public.personal_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Study workspace blob (owner-scoped JSON — same shape as local hr-personal-v1 partialize)
create table if not exists public.personal_study_state (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists personal_study_state_updated_at_idx
  on public.personal_study_state (updated_at desc);

alter table public.personal_profiles enable row level security;
alter table public.personal_study_state enable row level security;

-- personal_profiles policies
drop policy if exists "personal_profiles_select_own" on public.personal_profiles;
create policy "personal_profiles_select_own"
  on public.personal_profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "personal_profiles_insert_own" on public.personal_profiles;
create policy "personal_profiles_insert_own"
  on public.personal_profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "personal_profiles_update_own" on public.personal_profiles;
create policy "personal_profiles_update_own"
  on public.personal_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "personal_profiles_delete_own" on public.personal_profiles;
create policy "personal_profiles_delete_own"
  on public.personal_profiles for delete
  to authenticated
  using (id = auth.uid());

-- personal_study_state policies
drop policy if exists "personal_study_state_select_own" on public.personal_study_state;
create policy "personal_study_state_select_own"
  on public.personal_study_state for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "personal_study_state_insert_own" on public.personal_study_state;
create policy "personal_study_state_insert_own"
  on public.personal_study_state for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "personal_study_state_update_own" on public.personal_study_state;
create policy "personal_study_state_update_own"
  on public.personal_study_state for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "personal_study_state_delete_own" on public.personal_study_state;
create policy "personal_study_state_delete_own"
  on public.personal_study_state for delete
  to authenticated
  using (owner_id = auth.uid());

-- Auto profile row on signup
create or replace function public.personal_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.personal_profiles (id, handle)
  values (new.id, coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.personal_study_state (owner_id, data)
  values (new.id, '{}'::jsonb)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_personal on auth.users;
create trigger on_auth_user_created_personal
  after insert on auth.users
  for each row execute function public.personal_handle_new_user();

-- updated_at helper
create or replace function public.personal_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists personal_profiles_set_updated_at on public.personal_profiles;
create trigger personal_profiles_set_updated_at
  before update on public.personal_profiles
  for each row execute function public.personal_set_updated_at();

drop trigger if exists personal_study_state_set_updated_at on public.personal_study_state;
create trigger personal_study_state_set_updated_at
  before update on public.personal_study_state
  for each row execute function public.personal_set_updated_at();

-- Revoke anon access; authenticated only via RLS
revoke all on public.personal_profiles from anon;
revoke all on public.personal_study_state from anon;
grant select, insert, update, delete on public.personal_profiles to authenticated;
grant select, insert, update, delete on public.personal_study_state to authenticated;
