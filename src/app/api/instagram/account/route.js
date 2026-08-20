import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramAccountService } from '@/lib/instagram/accountService';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = new InstagramAccountService(supabase, user.id);
    const account = await service.getPrimaryAccount();

    if (!account) {
      return NextResponse.json({ connected: false, account: null });
    }

    const { count } = await supabase
      .from('reels')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('instagram_account_id', account.id);

    return NextResponse.json({
      connected: true,
      account,
      reelsTracked: count ?? 0,
    });
  } catch (err) {
    console.error('GET instagram account:', err);
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 });
  }
}
