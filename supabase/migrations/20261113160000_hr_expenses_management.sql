-- Admin Lovable Cloud ONLY — Expenses Management (non-bank).
-- DO NOT APPLY without separate production approval.
-- Prerequisite recommendation: Attendance cloud sync (PR #19) verified first.
-- Never targets Driver Supabase (okzcwctsgurumnnzuxgg).
-- No IBAN / account ciphertext here — banking stays in 20261105180000_hr_employee_finance_secure.sql.

-- Admin email gate (idempotent if finance migration already created private schema helpers)
create schema if not exists private;

create or replace function private.hr_is_finance_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') = 'hr.compliance@gmail.com',
    false
  );
$$;

create table if not exists public.hr_expense_categories (
  id text primary key,
  name text not null,
  custom boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id text not null references public.hr_expense_categories (id),
  amount_pkr integer not null check (amount_pkr > 0),
  expense_date date not null,
  scope text not null check (scope in ('one', 'multiple', 'all')),
  employee_ids text[] not null default '{}',
  status text not null check (status in ('draft', 'submitted', 'approved', 'paid', 'rejected', 'cancelled')),
  note text not null default '',
  deleted_at timestamptz,
  template_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_expenses_scope_employees check (
    (scope = 'all' and cardinality(employee_ids) = 0)
    or (scope = 'one' and cardinality(employee_ids) = 1)
    or (scope = 'multiple' and cardinality(employee_ids) >= 2)
  )
);

create table if not exists public.hr_expense_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  category_id text not null references public.hr_expense_categories (id),
  amount_pkr integer not null check (amount_pkr > 0),
  scope text not null check (scope in ('one', 'multiple', 'all')),
  employee_ids text[] not null default '{}',
  note text not null default '',
  cadence text not null check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_expense_budgets (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  category_id text not null references public.hr_expense_categories (id),
  limit_pkr integer not null check (limit_pkr >= 0),
  note text not null default '',
  unique (month, category_id)
);

create table if not exists public.hr_expense_audit_log (
  id bigserial primary key,
  expense_id uuid,
  actor_email text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.hr_expense_categories enable row level security;
alter table public.hr_expense_categories force row level security;
alter table public.hr_expenses enable row level security;
alter table public.hr_expenses force row level security;
alter table public.hr_expense_templates enable row level security;
alter table public.hr_expense_templates force row level security;
alter table public.hr_expense_budgets enable row level security;
alter table public.hr_expense_budgets force row level security;
alter table public.hr_expense_audit_log enable row level security;
alter table public.hr_expense_audit_log force row level security;

drop policy if exists hr_expense_categories_admin on public.hr_expense_categories;
create policy hr_expense_categories_admin on public.hr_expense_categories
  for all using (private.hr_is_finance_admin()) with check (private.hr_is_finance_admin());

drop policy if exists hr_expenses_admin on public.hr_expenses;
create policy hr_expenses_admin on public.hr_expenses
  for all using (private.hr_is_finance_admin()) with check (private.hr_is_finance_admin());

drop policy if exists hr_expense_templates_admin on public.hr_expense_templates;
create policy hr_expense_templates_admin on public.hr_expense_templates
  for all using (private.hr_is_finance_admin()) with check (private.hr_is_finance_admin());

drop policy if exists hr_expense_budgets_admin on public.hr_expense_budgets;
create policy hr_expense_budgets_admin on public.hr_expense_budgets
  for all using (private.hr_is_finance_admin()) with check (private.hr_is_finance_admin());

drop policy if exists hr_expense_audit_admin on public.hr_expense_audit_log;
create policy hr_expense_audit_admin on public.hr_expense_audit_log
  for all using (private.hr_is_finance_admin()) with check (private.hr_is_finance_admin());

revoke all on public.hr_expense_categories from anon, authenticated;
revoke all on public.hr_expenses from anon, authenticated;
revoke all on public.hr_expense_templates from anon, authenticated;
revoke all on public.hr_expense_budgets from anon, authenticated;
revoke all on public.hr_expense_audit_log from anon, authenticated;

grant select, insert, update, delete on public.hr_expense_categories to authenticated;
grant select, insert, update, delete on public.hr_expenses to authenticated;
grant select, insert, update, delete on public.hr_expense_templates to authenticated;
grant select, insert, update, delete on public.hr_expense_budgets to authenticated;
grant select, insert on public.hr_expense_audit_log to authenticated;

-- Seed built-in categories (idempotent)
insert into public.hr_expense_categories (id, name, custom, archived)
values
  ('fuel', 'Fuel', false, false),
  ('office', 'Office supplies', false, false),
  ('travel', 'Travel', false, false),
  ('utilities', 'Utilities', false, false),
  ('maintenance', 'Maintenance', false, false),
  ('meals', 'Meals / hospitality', false, false),
  ('training', 'Training', false, false),
  ('other', 'Other', false, false)
on conflict (id) do nothing;
