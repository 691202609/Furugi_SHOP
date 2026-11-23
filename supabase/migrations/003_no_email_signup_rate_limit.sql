-- Furugi SHOP — public signup protection for the no-email-confirmation flow
-- Backend only. No browser policy is granted.

create table if not exists public.customer_signup_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now()
);

alter table public.customer_signup_limits enable row level security;

create or replace function public.consume_customer_signup_attempt(
  p_key text,
  p_limit integer default 10,
  p_window_seconds integer default 3600
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.customer_signup_limits%rowtype;
  v_now timestamptz := now();
  v_limit integer := greatest(1, least(coalesce(p_limit,10), 100));
  v_window integer := greatest(60, least(coalesce(p_window_seconds,3600), 86400));
begin
  insert into public.customer_signup_limits(key, window_started_at, attempts, updated_at)
  values(p_key, v_now, 1, v_now)
  on conflict (key) do update set
    attempts = case
      when public.customer_signup_limits.window_started_at < v_now - make_interval(secs => v_window)
        then 1
      else public.customer_signup_limits.attempts + 1
    end,
    window_started_at = case
      when public.customer_signup_limits.window_started_at < v_now - make_interval(secs => v_window)
        then v_now
      else public.customer_signup_limits.window_started_at
    end,
    updated_at = v_now
  returning * into r;
  return r.attempts <= v_limit;
end;
$$;

revoke all on table public.customer_signup_limits from public, anon, authenticated;
revoke all on function public.consume_customer_signup_attempt(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_customer_signup_attempt(text,integer,integer) to service_role;
