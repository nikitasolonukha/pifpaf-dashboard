import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!name || name.length > 80) {
      return NextResponse.json({ error: 'Укажи имя' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
    }
    if (password.length < 6 || password.length > 72) {
      return NextResponse.json({ error: 'Пароль: минимум 6 символов' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Сервер не настроен' }, { status: 500 });
    }

    const admin = createServiceClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    });

    if (error) {
      const msg = String(error.message || '');
      if (/already|registered|exists/i.test(msg)) {
        return NextResponse.json(
          { error: 'Этот email уже зарегистрирован. Войди в аккаунт.' },
          { status: 409 },
        );
      }
      if (/rate limit|over_email/i.test(msg)) {
        return NextResponse.json(
          { error: 'Слишком много попыток. Подожди пару минут или войди, если аккаунт уже есть.' },
          { status: 429 },
        );
      }
      console.error('POST /api/auth/signup:', error);
      return NextResponse.json({ error: 'Не удалось создать аккаунт' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      userId: data.user?.id || null,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/auth/signup:', err);
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }
}
