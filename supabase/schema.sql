create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.plan_key as enum ('free', 'creator', 'pro', 'business');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'refunded', 'paused', 'incomplete');
create type public.boost_job_status as enum ('draft', 'queued', 'processing', 'rendering', 'completed', 'failed');
create type public.processor_provider_key as enum ('mock', 'n8n');
create type public.boost_preset_key as enum ('hook-boost', 'caption-boost', 'retention-boost', 'balanced');
create type public.target_platform_key as enum ('tiktok', 'youtube-shorts', 'instagram-reels');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role app_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key plan_key unique not null,
  name text not null,
  monthly_credits integer not null,
  max_file_size_mb integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_key plan_key not null default 'free',
  status subscription_status not null default 'trialing',
  credits_total integer not null default 2 check (credits_total >= 0),
  credits_used integer not null default 0 check (credits_used >= 0 and credits_used <= credits_total),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid,
  change_amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.boost_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_name text not null check (char_length(project_name) <= 120),
  status boost_job_status not null default 'draft',
  preset boost_preset_key not null default 'balanced',
  target_platform target_platform_key not null default 'tiktok',
  description text check (description is null or char_length(description) <= 2000),
  subtitle_style text check (subtitle_style is null or char_length(subtitle_style) <= 80),
  add_opening_text boolean not null default true,
  crop_mode text check (crop_mode is null or char_length(crop_mode) <= 80),
  extra_notes text check (extra_notes is null or char_length(extra_notes) <= 2000),
  processor_provider processor_provider_key not null default 'mock',
  external_job_id text,
  source_video_url text not null check (char_length(source_video_url) <= 2048),
  source_storage_path text check (source_storage_path is null or char_length(source_storage_path) <= 1024),
  source_file_name text check (source_file_name is null or char_length(source_file_name) <= 255),
  output_video_url text check (output_video_url is null or char_length(output_video_url) <= 2048),
  output_poster_url text check (output_poster_url is null or char_length(output_poster_url) <= 2048),
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id text not null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(provider) between 2 and 40),
  dedupe_key text not null check (char_length(dedupe_key) between 16 and 255),
  event_id text check (event_id is null or char_length(event_id) <= 255),
  event_name text check (event_name is null or char_length(event_name) <= 120),
  target_user_id uuid references public.profiles(id) on delete set null,
  payload_hash text not null check (char_length(payload_hash) = 64),
  status text not null default 'received' check (status in ('received', 'processing', 'processed', 'failed', 'skipped')),
  processing_attempts integer not null default 1 check (processing_attempts >= 1),
  metadata jsonb not null default '{}'::jsonb,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  processed_at timestamptz
);

insert into public.plans (key, name, monthly_credits, max_file_size_mb)
values
  ('free', 'Free', 2, 150),
  ('creator', 'Creator', 50, 500),
  ('pro', 'Pro', 100, 1024),
  ('business', 'Business', 1000, 2048)
on conflict (key) do update
set
  name = excluded.name,
  monthly_credits = excluded.monthly_credits,
  max_file_size_mb = excluded.max_file_size_mb,
  active = true,
  updated_at = now();

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.boost_jobs enable row level security;
alter table public.admin_events enable row level security;
alter table public.webhook_events enable row level security;

create policy "Users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Authenticated users read plans" on public.plans for select to authenticated using (true);
create policy "Anon users read plans" on public.plans for select to anon using (active = true);

create policy "Users read own subscription" on public.subscriptions for select using (auth.uid() = user_id);
create policy "Users read own usage ledger" on public.usage_ledger for select using (auth.uid() = user_id);
create policy "Users read own boost jobs" on public.boost_jobs for select using (auth.uid() = user_id);
create policy "Users insert own boost jobs" on public.boost_jobs for insert with check (auth.uid() = user_id);
create policy "Users update own boost jobs" on public.boost_jobs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('source-videos', 'source-videos', false)
on conflict (id) do update
set public = false;

create policy "Users upload source videos" on storage.objects
for insert to authenticated
with check (bucket_id = 'source-videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read source videos" on storage.objects
for select to authenticated
using (bucket_id = 'source-videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Service role manages source videos" on storage.objects
for all
using (bucket_id = 'source-videos')
with check (bucket_id = 'source-videos');

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  free_plan public.plans%rowtype;
begin
  select * into free_plan from public.plans where key = 'free';

  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url');

  insert into public.subscriptions (
    user_id,
    plan_key,
    status,
    credits_total,
    credits_used,
    current_period_start,
    current_period_end
  )
  values (
    new.id,
    'free',
    'trialing',
    coalesce(free_plan.monthly_credits, 2),
    0,
    now(),
    now() + interval '30 days'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create index boost_jobs_user_created_idx on public.boost_jobs(user_id, created_at desc);
create index boost_jobs_status_idx on public.boost_jobs(status);
create index usage_ledger_user_created_idx on public.usage_ledger(user_id, created_at desc);
create unique index webhook_events_provider_dedupe_idx on public.webhook_events(provider, dedupe_key);
create index webhook_events_target_user_idx on public.webhook_events(target_user_id, received_at desc);
create index webhook_events_status_idx on public.webhook_events(status, received_at desc);
create index webhook_events_event_id_idx on public.webhook_events(provider, event_id);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'video_jobs'
  ) then
    create index if not exists video_jobs_user_created_idx on public.video_jobs(user_id, created_at desc);
    create index if not exists video_jobs_status_idx on public.video_jobs(status);
    create index if not exists video_jobs_execution_idx on public.video_jobs(n8n_execution_id);

    if not exists (select 1 from pg_constraint where conname = 'video_jobs_progress_range') then
      alter table public.video_jobs
      add constraint video_jobs_progress_range
      check (progress is null or (progress >= 0 and progress <= 100));
    end if;

    if not exists (select 1 from pg_constraint where conname = 'video_jobs_credits_reserved_nonnegative') then
      alter table public.video_jobs
      add constraint video_jobs_credits_reserved_nonnegative
      check (credits_reserved is null or credits_reserved >= 0);
    end if;

    if not exists (select 1 from pg_constraint where conname = 'video_jobs_title_length') then
      alter table public.video_jobs
      add constraint video_jobs_title_length
      check (title is null or char_length(title) <= 120);
    end if;

    if not exists (select 1 from pg_constraint where conname = 'video_jobs_error_message_length') then
      alter table public.video_jobs
      add constraint video_jobs_error_message_length
      check (error_message is null or char_length(error_message) <= 2000);
    end if;

    if not exists (select 1 from pg_constraint where conname = 'video_jobs_output_asset_path_length') then
      alter table public.video_jobs
      add constraint video_jobs_output_asset_path_length
      check (output_asset_path is null or char_length(output_asset_path) <= 2048);
    end if;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'subscriptions'
  ) then
    create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
    create index if not exists subscriptions_customer_idx on public.subscriptions(stripe_customer_id);
    create index if not exists subscriptions_subscription_idx on public.subscriptions(stripe_subscription_id);
    create index if not exists subscriptions_status_idx on public.subscriptions(status);

    if not exists (select 1 from pg_constraint where conname = 'subscriptions_credits_total_nonnegative') then
      alter table public.subscriptions
      add constraint subscriptions_credits_total_nonnegative
      check (credits_total >= 0);
    end if;

    if not exists (select 1 from pg_constraint where conname = 'subscriptions_credits_used_range') then
      alter table public.subscriptions
      add constraint subscriptions_credits_used_range
      check (credits_used >= 0 and credits_used <= credits_total);
    end if;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    create index if not exists profiles_role_idx on public.profiles(role);

    if not exists (select 1 from pg_constraint where conname = 'profiles_email_length') then
      alter table public.profiles
      add constraint profiles_email_length
      check (char_length(email) between 3 and 320);
    end if;

    if not exists (select 1 from pg_constraint where conname = 'profiles_full_name_length') then
      alter table public.profiles
      add constraint profiles_full_name_length
      check (full_name is null or char_length(full_name) <= 120);
    end if;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'usage_ledger'
  ) then
    create index if not exists usage_ledger_job_idx on public.usage_ledger(job_id);

    if not exists (select 1 from pg_constraint where conname = 'usage_ledger_reason_length') then
      alter table public.usage_ledger
      add constraint usage_ledger_reason_length
      check (char_length(reason) <= 120);
    end if;
  end if;
end
$$;
