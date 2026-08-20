# PifPaf Creator — кабинет блогера

Внутренний web-кабинет для блогеров: подключение публичного Instagram-профиля, импорт Reels за 12 месяцев, dashboard, синхронизация метрик и snapshot-based growth.

## Основной flow

1. Signup / Login (Supabase Auth)
2. Onboarding: connect Instagram profile URL / `@username`
3. Apify `instagram-reel-scraper` собирает публичные Reels (12 месяцев)
4. Dashboard: KPI, Top-20, Top Reels, месячные графики, latest Reels, growth
5. My Reels: grid/table, manual Reel add, delete, single refresh
6. Analytics: те же метрики с фильтром периода
7. Sync: atomic lock → Apify → bulk upsert + snapshots → honest summary toast

## Stack

- Next.js 16 (App Router, JavaScript)
- Tailwind CSS 4
- Supabase (Auth, Postgres, Storage, RLS)
- Apify (`apify/instagram-reel-scraper`)
- Recharts

## Архитектура

```
src/
├── app/(auth)          login / signup
├── app/(app)           dashboard, reels, analytics, account, onboarding
├── app/api             dashboard, reels, instagram connect/sync
├── components          UI (утверждённый pastel layout)
├── lib/apify           scrape, normalize, exact reel match, covers
├── lib/instagram       accountService, profileImport, syncLock
├── lib/supabase        browser / server / proxy session
└── proxy.js            session refresh + API 401 JSON
supabase/migrations     001…006
tests/                  unit tests (no network)
scripts/                smoke-e2e, smoke-profile-e2e
```

## Env

Скопируй `.env.example` → `.env.local`:

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (cover upload to Storage) |
| `APIFY_API_TOKEN` | Server only (profile / reel scrape) |

Секреты в git не коммитятся (`.env*.local` в `.gitignore`).

## Local run (Docker Supabase)

```bash
npm install
npm run db:start          # Docker containers
npm run db:push           # migrations up
cp .env.example .env.local
# заполнить ключами из `npx supabase status`
npm run dev               # http://localhost:3002
```

Studio: http://127.0.0.1:54323

## Migrations / RLS

- `001` profiles, reels, snapshots, storage bucket
- `002` grants
- `003–005` instagram_accounts + RLS fixes
- `006` drop open storage INSERT policy (service role bypasses RLS; upload only via service client)

RLS: user читает/пишет только свои `profiles`, `reels`, `reel_metric_snapshots`, `instagram_accounts`.

## Apify

- Actor: `apify/instagram-reel-scraper`
- Profile: username = profile URL, `onlyPostsNewerThan` = 12 months, paid extras off
- Direct Reel: exact shortcode match (never first random item)
- Views: `videoPlayCount ?? videoViewCount`

## Profile import

1. Atomic claim `sync_status=syncing` (connect + sync)
2. One Apify run → normalize → **dedupe by shortcode**
3. Covers: bounded concurrency (5)
4. Reels: chunked upsert `(user_id, shortcode)`
5. Snapshots: chunked bulk insert
6. Summary: `checked / newCount / updatedCount / failedCount / viewsDelta` (только успешные writes)

Stale lock: `SYNC_STALE_MS` (10 мин). Cooldown между sync: `SYNC_COOLDOWN_MS` (3 мин).

## Manual Reel

`POST /api/reels` — validate URL → exact scrape → insert + snapshot. Не подменяет другим Reel.

## Snapshots / growth

Growth = sum(latest − previous) по snapshots на Reel. Отрицательные delta сохраняются. Один snapshot → growth unavailable.

## API auth

`proxy.js` / session helper: для `/api/*` без сессии → **401 JSON** `{ error: "Unauthorized" }`, без HTML redirect на `/login`.

## Tests / CI

```bash
npm test
npm run lint
npm run build
```

GitHub Actions: `.github/workflows/ci.yml` (unit + lint + build, dummy env, без live Apify).

Live smoke (нужны credentials в `.env.local`):

```bash
node --env-file=.env.local scripts/smoke-e2e.mjs
node --env-file=.env.local scripts/smoke-profile-e2e.mjs
```

## Known limitations

- Только публичные Instagram данные
- Метрики — snapshot на момент Apify scrape
- Profile sync может занимать несколько минут (честный indeterminate UI, без fake %)
- Covers: permanent upload только JPEG; иначе fallback `source_cover_url`
- UI сейчас использует primary Instagram account (мульти-аккаунт в схеме есть, UI не расширен)
