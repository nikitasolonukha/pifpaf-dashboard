import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramAccountService } from '@/lib/instagram/accountService';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    let period;
    try {
      const body = await request.json();
      period = body?.period;
    } catch {
      period = undefined;
    }

    const service = new InstagramAccountService(supabase, user.id);
    const result = await service.sync(id, { period });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      account: result.account,
      summary: result.summary,
    });
  } catch (err) {
    console.error('POST /api/instagram/[id]/sync:', err);
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }
}
