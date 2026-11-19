-- Furugi SHOP — Production hardening migration
-- Safe to run on an existing Furugi v4 database.

create extension if not exists pgcrypto;

alter table public.store_settings
  add column if not exists cod_reserve_minutes integer not null default 2880;

alter table public.store_settings drop constraint if exists store_settings_cod_reserve_minutes_check;
alter table public.store_settings
  add constraint store_settings_cod_reserve_minutes_check check (cod_reserve_minutes >= 60);

create index if not exists idx_orders_customer_cod_pending
  on public.orders(customer_id,payment_method,status,restocked);

create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.store_settings%rowtype;
  r record;
  n integer := 0;
begin
  select * into s from public.store_settings where id=1;
  if not found then return 0; end if;
  for r in
    select id,payment_method from public.orders
     where status='pending' and restocked=false
       and (
         (payment_status='unpaid' and payment_method in ('promptpay','bank')
          and created_at < now() - make_interval(mins => greatest(30,s.reserve_minutes)))
         or
         (payment_status='cod' and payment_method='cod'
          and created_at < now() - make_interval(mins => greatest(60,s.cod_reserve_minutes)))
       )
  loop
    perform public.cancel_store_order(
      r.id,
      case when r.payment_method='cod'
        then 'ยกเลิกอัตโนมัติ: ออเดอร์ COD ไม่ได้รับการยืนยันภายในเวลาที่กำหนด'
        else 'ยกเลิกอัตโนมัติ: ไม่พบการชำระภายในเวลาที่กำหนด'
      end
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;
grant execute on function public.expire_unpaid_orders() to service_role;

create table if not exists public.customer_action_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now()
);
alter table public.customer_action_limits enable row level security;

create or replace function public.consume_customer_action_attempt(
  p_key text, p_limit integer default 10, p_window_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.customer_action_limits%rowtype;
  v_now timestamptz := now();
  v_limit integer := greatest(1, least(coalesce(p_limit,10), 500));
  v_window integer := greatest(30, least(coalesce(p_window_seconds,600), 86400));
begin
  insert into public.customer_action_limits(key, window_started_at, attempts, updated_at)
  values(p_key, v_now, 1, v_now)
  on conflict (key) do update set
    attempts = case when public.customer_action_limits.window_started_at < v_now - make_interval(secs => v_window)
      then 1 else public.customer_action_limits.attempts + 1 end,
    window_started_at = case when public.customer_action_limits.window_started_at < v_now - make_interval(secs => v_window)
      then v_now else public.customer_action_limits.window_started_at end,
    updated_at = v_now
  returning * into r;
  return r.attempts <= v_limit;
end;
$$;

revoke all on table public.customer_action_limits from public, anon, authenticated;
revoke all on function public.consume_customer_action_attempt(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_customer_action_attempt(text,integer,integer) to service_role;

create or replace function public.furugi_system_health()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_profiles boolean := to_regclass('public.profiles') is not null;
  v_settings boolean := to_regclass('public.store_settings') is not null;
  v_products boolean := to_regclass('public.products') is not null;
  v_orders boolean := to_regclass('public.orders') is not null;
  v_order_items boolean := to_regclass('public.order_items') is not null;
  v_contacts boolean := to_regclass('public.contact_messages') is not null;
  v_signup_limits boolean := to_regclass('public.customer_signup_limits') is not null;
  v_action_limits boolean := to_regclass('public.customer_action_limits') is not null;
  v_create_order boolean := to_regprocedure('public.create_store_order(uuid,jsonb,jsonb,text,text)') is not null;
  v_cancel_order boolean := to_regprocedure('public.cancel_store_order(text,text)') is not null;
  v_expire_orders boolean := to_regprocedure('public.expire_unpaid_orders()') is not null;
  v_signup_rpc boolean := to_regprocedure('public.consume_customer_signup_attempt(text,integer,integer)') is not null;
  v_action_rpc boolean := to_regprocedure('public.consume_customer_action_attempt(text,integer,integer)') is not null;
  v_product_bucket boolean;
  v_payment_bucket boolean;
  v_settings_row boolean;
  v_ok boolean;
begin
  select exists(select 1 from storage.buckets where id='product-images') into v_product_bucket;
  select exists(select 1 from storage.buckets where id='payment-slips') into v_payment_bucket;
  select exists(select 1 from public.store_settings where id=1) into v_settings_row;
  v_ok := v_profiles and v_settings and v_products and v_orders and v_order_items and v_contacts
    and v_signup_limits and v_action_limits and v_create_order and v_cancel_order and v_expire_orders
    and v_signup_rpc and v_action_rpc and v_product_bucket and v_payment_bucket and v_settings_row;
  return jsonb_build_object('ok',v_ok,'checks',jsonb_build_object(
    'profiles',v_profiles,'storeSettings',v_settings and v_settings_row,'products',v_products,
    'orders',v_orders,'orderItems',v_order_items,'contactMessages',v_contacts,
    'signupRateLimit',v_signup_limits and v_signup_rpc,'orderRateLimit',v_action_limits and v_action_rpc,
    'orderRpc',v_create_order and v_cancel_order and v_expire_orders,
    'productImagesBucket',v_product_bucket,'paymentSlipsBucket',v_payment_bucket));
end;
$$;

revoke all on function public.furugi_system_health() from public, anon, authenticated;
grant execute on function public.furugi_system_health() to service_role;
