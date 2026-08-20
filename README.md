# PifPaf AI — Кабинет блогера

Внутренний web dashboard для блогеров PifPaf AI. Каждый пользователь видит и управляет только своими Instagram Reels.

## Stack

- Next.js 16 (App Router, JavaScript)
- Tailwind CSS 4
- Supabase (Auth, PostgreSQL, Storage)
- Apify (`apify/instagram-reel-scraper`)
- Recharts
- Lucide React

## Архитектура

```
src/
├── app/
│   ├── (auth)/login, signup    — страницы авторизации
│   ├── (app)/dashboard         — главная с KPI
│   ├── (app)/reels             — лента Reels (grid/table)
│   ├── (app)/reels/[id]        — детальная страница Reel
│   ├── (app)/analytics         — общая аналитика
│   └── api/                    — серверные API routes
├── components/                 — UI компоненты
├── lib/
│   ├── supabase/               — клиенты Supabase (browser, server, middleware)
│   ├── apify/                  — Apify integration + cover upload
│   └── format.js               — форматирование чисел и дат
└── middleware.js               — защита маршрутов
```

## Как запустить

```bash
npm install
cp .env.example .env.local
# Заполнить .env.local (или использовать локальный Supabase — см. ниже)
npm run dev
```

### Локальный Supabase (Docker)

```bash
# Требуется Docker Desktop
npx supabase start

# Ключи для .env.local (после start):
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY из вывода supabase start>
# SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY из вывода supabase start>

npm run dev
```

Studio: http://127.0.0.1:54323  
Mailpit (письма signup): http://127.0.0.1:54324

Миграции применяются автоматически при `supabase start` из `supabase/migrations/`.

## Env variables

| Переменная | Описание | Где используется |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key Supabase | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Server only (cover upload) |
| `APIFY_API_TOKEN` | Токен Apify | Server only |

## Supabase setup

1. Создать проект в Supabase.
2. Выполнить SQL из `supabase/migrations/001_initial.sql` в SQL Editor.
3. В Storage убедиться, что bucket `reel-covers` создан (миграция делает это автоматически).
4. Включить Email auth в Authentication → Providers.

## Apify setup

1. Зарегистрироваться на apify.com.
2. Получить API token в Settings → Integrations.
3. Указать в `APIFY_API_TOKEN`.

## Как работает Reel import

1. Пользователь вставляет URL.
2. Server валидирует URL (regex на shortcode).
3. Проверяет duplicate по `(user_id, shortcode)`.
4. Вызывает `apify/instagram-reel-scraper` с прямым Reel URL через `username: [url]` и отключёнными платными extras.
5. Нормализует данные (`videoPlayCount ?? videoViewCount`).
6. Скачивает cover → Supabase Storage.
7. Вставляет запись в `reels` + первый `reel_metric_snapshots`.

## Как работает metrics history

- Каждый refresh (ручной или "обновить все") создаёт новый snapshot.
- Chart строится по реальным snapshot records.
- На detail page видна полная история.

## Known limitations

- Доступны только публичные Instagram данные.
- Показатели являются snapshot на момент Apify scrape.
- Цифры могут немного отличаться от authenticated Instagram view.
- Realtime streaming не реализован.
- Apify actor может быть rate-limited при частых запросах.
- Permanent cover download хранит только JPEG (`image/jpeg`); если Apify отдаёт другой формат, используется fallback `displayUrl`.
