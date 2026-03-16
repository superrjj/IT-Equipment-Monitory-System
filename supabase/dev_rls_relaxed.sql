-- DEV ONLY: Relax RLS so the app works without Supabase Auth.
-- Apply AFTER running `supabase/app_schema.sql`.
-- Do NOT use this in production.

alter table public.user_accounts enable row level security;
alter table public.signup_requests enable row level security;
alter table public.user_sessions enable row level security;

-- signup_requests: anyone can read/update for dev
drop policy if exists "dev_signup_requests_select_all" on public.signup_requests;
create policy "dev_signup_requests_select_all"
on public.signup_requests for select
using (true);

drop policy if exists "dev_signup_requests_update_all" on public.signup_requests;
create policy "dev_signup_requests_update_all"
on public.signup_requests for update
using (true)
with check (true);

-- user_accounts: anyone can read/write for dev
drop policy if exists "dev_user_accounts_all" on public.user_accounts;
create policy "dev_user_accounts_all"
on public.user_accounts for all
using (true)
with check (true);

-- user_sessions: anyone can read/write for dev
drop policy if exists "dev_user_sessions_all" on public.user_sessions;
create policy "dev_user_sessions_all"
on public.user_sessions for all
using (true)
with check (true);

