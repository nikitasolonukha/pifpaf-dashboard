-- Instagram accounts (one user may have several)
create table if not exists public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  profile_url text not null,
  display_name text,
  avatar_url text,
  sync_status text not null default 'ready',
  sync_error text,
  last_synced_at timestamptz,
  import_since date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint instagram_accounts_user_username unique (user_id, username)
);

create index instagram_accounts_user_id on public.instagram_accounts(user_id);

alter table public.instagram_accounts enable row level security;

create policy "Users can view own instagram accounts"
  on public.instagram_accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own instagram accounts"
  on public.instagram_accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own instagram accounts"
  on public.instagram_accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete own instagram accounts"
  on public.instagram_accounts for delete
  using (auth.uid() = user_id);

-- Link reels to instagram accounts (nullable for collab / direct adds)
alter table public.reels
  add column if not exists instagram_account_id uuid references public.instagram_accounts(id) on delete set null;

create index if not exists reels_instagram_account_id on public.reels(instagram_account_id);

-- Backfill: create accounts from existing owner_username groups
insert into public.instagram_accounts (user_id, username, profile_url, display_name, last_synced_at, import_since)
select
  r.user_id,
  (array_agg(r.owner_username order by r.created_at desc))[1] as username,
  'https://www.instagram.com/' || (array_agg(r.owner_username order by r.created_at desc))[1] || '/',
  (array_agg(r.owner_full_name order by r.created_at desc))[1],
  max(r.last_synced_at),
  (current_date - interval '12 months')::date
from public.reels r
where r.owner_username is not null and trim(r.owner_username) <> ''
group by r.user_id, lower(r.owner_username)
on conflict (user_id, username) do nothing;

update public.reels r
set instagram_account_id = ia.id
from public.instagram_accounts ia
where r.instagram_account_id is null
  and r.owner_username is not null
  and r.user_id = ia.user_id
  and lower(r.owner_username) = lower(ia.username);
