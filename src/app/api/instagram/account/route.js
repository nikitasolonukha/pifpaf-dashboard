import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InstagramAccountService } from '@/lib/instagram/accountService';
import { sanitizeAccountForClient } from '@/lib/apify/profileScraper.mjs';

export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountIdParam = searchParams.get('accountId');
    if (accountIdParam && !UUID_RE.test(accountIdParam)) {
      return NextResponse.json({ error: 'Некорректный accountId' }, { status: 400 });
    }

    const service = new InstagramAccountService(supabase, user.id);
    const ticked = await service.tickAllPendingImports();
    const accounts = ticked.accounts;
    const account = accountIdParam
      ? accounts.find((a) => a.id === accountIdParam) || null
      : accounts[0] || null;

    if (!accounts.length) {
      return NextResponse.json({
        connected: false,
        account: null,
        accounts: [],
        reelsTracked: 0,
        reelsTrackedByAccount: {},
        summary: null,
      });
    }

    const { data: counts } = await supabase
      .from('reels')
      .select('instagram_account_id')
      .eq('user_id', user.id)
      .not('instagram_account_id', 'is', null);

    const reelsTrackedByAccount = {};
    for (const row of counts || []) {
      const id = row.instagram_account_id;
      reelsTrackedByAccount[id] = (reelsTrackedByAccount[id] || 0) + 1;
    }

    return NextResponse.json({
      connected: !!account,
      account: sanitizeAccountForClient(account),
      accounts: accounts.map(sanitizeAccountForClient),
      reelsTracked: account ? (reelsTrackedByAccount[account.id] || 0) : 0,
      reelsTrackedByAccount,
      summary: ticked.summary || null,
    });
  } catch (err) {
    console.error('GET instagram account:', err);
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 });
  }
}
