import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppLayoutClient from '@/components/AppLayoutClient';
import { Suspense } from 'react';

export default async function AppLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  let hasInstagram = false;
  const { count, error: accountsError } = await supabase
    .from('instagram_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (accountsError) {
    // Migration 003 not applied yet — fall back so app still loads.
    console.error('instagram_accounts query failed:', accountsError.message);
    hasInstagram = !!profile?.instagram_username;
  } else {
    hasInstagram = (count ?? 0) > 0;
  }

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--bg)' }} />}>
      <AppLayoutClient profile={profile} hasInstagram={hasInstagram}>
        {children}
      </AppLayoutClient>
    </Suspense>
  );
}
