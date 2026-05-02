create table if not exists public.youtube_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  channel_id text check (channel_id is null or char_length(channel_id) <= 255),
  channel_title text check (channel_title is null or char_length(channel_title) <= 120),
  channel_thumbnail_url text check (channel_thumbnail_url is null or char_length(channel_thumbnail_url) <= 2048),
  encrypted_access_token text not null check (char_length(encrypted_access_token) <= 4096),
  encrypted_refresh_token text check (encrypted_refresh_token is null or char_length(encrypted_refresh_token) <= 4096),
  access_token_expires_at timestamptz,
  scope text check (scope is null or char_length(scope) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.youtube_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null,
  youtube_video_id text check (youtube_video_id is null or char_length(youtube_video_id) <= 255),
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 5000),
  tags text[] not null default '{}'::text[],
  privacy_status text not null check (privacy_status in ('private', 'unlisted', 'public')),
  publish_at timestamptz,
  status text not null default 'queued' check (status in ('queued', 'uploaded', 'scheduled', 'failed')),
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.youtube_connections enable row level security;
alter table public.youtube_publications enable row level security;

drop policy if exists "Users read own youtube connections" on public.youtube_connections;
create policy "Users read own youtube connections"
on public.youtube_connections
for select
using (auth.uid() = user_id);

drop policy if exists "Users read own youtube publications" on public.youtube_publications;
create policy "Users read own youtube publications"
on public.youtube_publications
for select
using (auth.uid() = user_id);

create index if not exists youtube_connections_channel_idx on public.youtube_connections(channel_id);
create index if not exists youtube_publications_user_created_idx on public.youtube_publications(user_id, created_at desc);
create index if not exists youtube_publications_job_idx on public.youtube_publications(job_id, created_at desc);
create index if not exists youtube_publications_status_idx on public.youtube_publications(status, created_at desc);
