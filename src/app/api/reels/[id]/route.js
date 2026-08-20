import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: deleted, error } = await supabase
      .from('reels')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id');

    if (error) throw error;
    if (!deleted?.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE reel error:', err);
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: reel, error } = await supabase
      .from('reels')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !reel) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: snapshots } = await supabase
      .from('reel_metric_snapshots')
      .select('*')
      .eq('reel_id', id)
      .order('captured_at', { ascending: true });

    return NextResponse.json({ reel, snapshots: snapshots || [] });
  } catch (err) {
    console.error('GET reel error:', err);
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 });
  }
}
