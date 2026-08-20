-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  instagram_username text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Reels
create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  instagram_url text not null,
  instagram_reel_id text,
  shortcode text,
  caption text,
  owner_username text,
  owner_full_name text,
  cover_url text,
  source_cover_url text,
  published_at timestamptz,
  views bigint default 0,
  likes bigint default 0,
  comments bigint default 0,
  sync_status text default 'ready',
  sync_error text,
  last_synced_at timestamptz,
  raw_apify_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reels enable row level security;

create unique index reels_user_shortcode on public.reels(user_id, shortcode);
create index reels_user_id on public.reels(user_id);
create index reels_user_published on public.reels(user_id, published_at desc);

create policy "Users can view own reels"
  on public.reels for select
  using (auth.uid() = user_id);

create policy "Users can insert own reels"
  on public.reels for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reels"
  on public.reels for update
  using (auth.uid() = user_id);

create policy "Users can delete own reels"
  on public.reels for delete
  using (auth.uid() = user_id);

-- Metric snapshots
create table if not exists public.reel_metric_snapshots (
  id bigint generated always as identity primary key,
  reel_id uuid not null references public.reels(id) on delete cascade,
  views bigint default 0,
  likes bigint default 0,
  comments bigint default 0,
  captured_at timestamptz default now()
);

alter table public.reel_metric_snapshots enable row level security;

create index snapshots_reel_captured on public.reel_metric_snapshots(reel_id, captured_at);

create policy "Users can view own snapshots"
  on public.reel_metric_snapshots for select
  using (
    exists (
      select 1 from public.reels
      where reels.id = reel_metric_snapshots.reel_id
        and reels.user_id = auth.uid()
    )
  );

create policy "Users can insert own snapshots"
  on public.reel_metric_snapshots for insert
  with check (
    exists (
      select 1 from public.reels
      where reels.id = reel_metric_snapshots.reel_id
        and reels.user_id = auth.uid()
    )
  );

-- Auto-create profile on signup (via trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket for reel covers
insert into storage.buckets (id, name, public)
values ('reel-covers', 'reel-covers', true)
on conflict (id) do nothing;

create policy "Anyone can read reel covers"
  on storage.objects for select
  using (bucket_id = 'reel-covers');

create policy "Service role can upload covers"
  on storage.objects for insert
  with check (bucket_id = 'reel-covers');
