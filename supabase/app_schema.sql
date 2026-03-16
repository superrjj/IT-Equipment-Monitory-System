-- IT Equipment Monitoring: custom accounts + approvals + sessions (Supabase Postgres)
-- Passwords are stored as bcrypt hashes (never decrypt; use bcrypt.compare).
--
-- NOTE:
-- For production security, prefer Supabase Auth + Edge Functions for sessions.
-- This schema supports a client-driven session table (OK for dev/internal use),
-- but do NOT treat it as fully secure without server-side enforcement.

create extension if not exists pgcrypto;

-- Base tables
create table if not exists public.user_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  full_name text not null,
  email text not null,
  role text not null default 'Staff',
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_accounts_username_len check (char_length(username) between 3 and 32),
  constraint user_accounts_username_charset check (username ~ '^[A-Za-z0-9_]+$'),
  constraint user_accounts_email_len check (char_length(email) between 6 and 254),
  constraint user_accounts_role check (role in ('Admin', 'Staff'))
);

create unique index if not exists user_accounts_username_unique_ci
  on public.user_accounts (lower(username));
create unique index if not exists user_accounts_email_unique_ci
  on public.user_accounts (lower(email));

create table if not exists public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  username text not null,
  email text not null,
  password_hash text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),

  constraint signup_requests_username_len check (char_length(username) between 3 and 32),
  constraint signup_requests_username_charset check (username ~ '^[A-Za-z0-9_]+$'),
  constraint signup_requests_email_len check (char_length(email) between 6 and 254),
  constraint signup_requests_status check (status in ('pending', 'approved', 'rejected'))
);

create unique index if not exists signup_requests_username_unique_ci
  on public.signup_requests (lower(username));
create unique index if not exists signup_requests_email_unique_ci
  on public.signup_requests (lower(email));

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_accounts(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint user_sessions_token_hash_len check (char_length(token_hash) between 32 and 128)
);

create unique index if not exists user_sessions_token_hash_unique on public.user_sessions (token_hash);
create index if not exists user_sessions_user_id_idx on public.user_sessions (user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_accounts_updated_at on public.user_accounts;
create trigger trg_user_accounts_updated_at
before update on public.user_accounts
for each row execute function public.set_updated_at();

-- ── RLS (STRICT template for production) ───────────────────────────────────────
-- This assumes Supabase Auth and a custom JWT claim `app_role='Admin'`.
-- If you are not using Supabase Auth yet, apply `dev_rls_relaxed.sql` for now.

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'app_role', '') = 'Admin'
$$;

alter table public.user_accounts enable row level security;
alter table public.signup_requests enable row level security;
alter table public.user_sessions enable row level security;

-- user_accounts: admin-only
drop policy if exists "user_accounts_admin_select" on public.user_accounts;
create policy "user_accounts_admin_select"
on public.user_accounts for select
using (public.is_admin());

drop policy if exists "user_accounts_admin_insert" on public.user_accounts;
create policy "user_accounts_admin_insert"
on public.user_accounts for insert
with check (public.is_admin());

drop policy if exists "user_accounts_admin_update" on public.user_accounts;
create policy "user_accounts_admin_update"
on public.user_accounts for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "user_accounts_admin_delete" on public.user_accounts;
create policy "user_accounts_admin_delete"
on public.user_accounts for delete
using (public.is_admin());

-- signup_requests: public insert pending; admin manages
drop policy if exists "signup_requests_public_insert" on public.signup_requests;
create policy "signup_requests_public_insert"
on public.signup_requests for insert
with check (status = 'pending');

drop policy if exists "signup_requests_admin_select" on public.signup_requests;
create policy "signup_requests_admin_select"
on public.signup_requests for select
using (public.is_admin());

drop policy if exists "signup_requests_admin_update" on public.signup_requests;
create policy "signup_requests_admin_update"
on public.signup_requests for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "signup_requests_admin_delete" on public.signup_requests;
create policy "signup_requests_admin_delete"
on public.signup_requests for delete
using (public.is_admin());

-- user_sessions: admin-only under strict RLS (prefer Edge Functions for real apps)
drop policy if exists "user_sessions_admin_select" on public.user_sessions;
create policy "user_sessions_admin_select"
on public.user_sessions for select
using (public.is_admin());

drop policy if exists "user_sessions_admin_insert" on public.user_sessions;
create policy "user_sessions_admin_insert"
on public.user_sessions for insert
with check (public.is_admin());

drop policy if exists "user_sessions_admin_delete" on public.user_sessions;
create policy "user_sessions_admin_delete"
on public.user_sessions for delete
using (public.is_admin());

