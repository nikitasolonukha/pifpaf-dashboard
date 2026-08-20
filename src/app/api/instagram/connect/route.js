import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramAccountService } from '@/lib/instagram/accountService';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const input = body?.input || body?.url || body?.username || '';
    const period = body?.period;

    const service = new InstagramAccountService(supabase, user.id);
    const result = await service.connect(input, { period });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      account: result.account,
      summary: result.summary,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/instagram/connect:', err);
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }
}
