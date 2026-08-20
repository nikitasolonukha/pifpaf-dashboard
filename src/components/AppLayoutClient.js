'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

export default function AppLayoutClient({ children, profile, hasInstagram }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = pathname === '/onboarding';
  const isChangeFlow = searchParams.get('change') === '1';

  useEffect(() => {
    if (!hasInstagram && !isOnboarding) {
      router.replace('/onboarding');
    }
    if (hasInstagram && isOnboarding && !isChangeFlow) {
      router.replace('/dashboard');
    }
  }, [hasInstagram, isOnboarding, isChangeFlow, router]);

  if (isOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar profile={profile} />
      <main className="flex-1 min-h-screen p-4 md:p-8 md:ml-[220px]">{children}</main>
    </div>
  );
}
