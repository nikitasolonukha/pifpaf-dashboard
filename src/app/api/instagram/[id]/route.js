import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramAccountService } from '@/lib/instagram/accountService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(String(id || ''))) {
      return NextResponse.json({ error: 'Некорректный id профиля' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = new InstagramAccountService(supabase, user.id);
    const result = await service.deleteAccount(id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      deletedId: result.deletedId,
      username: result.username,
    });
  } catch (err) {
    console.error('DELETE /api/instagram/[id]:', err);
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 });
  }
}
