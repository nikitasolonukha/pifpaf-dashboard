'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Home, Film, BarChart3, User, LogOut } from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Главная', icon: Home },
  { href: '/reels', label: 'Мои Reels', icon: Film },
  { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
];

function subscribe() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export default function Sidebar({ profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const isClient = useIsClient();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function isActive(href) {
    if (!isClient) return false;
    return pathname.startsWith(href);
  }

  const accountActive = isClient && pathname === '/account';

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-4 top-4 bottom-4 w-[200px] flex-col rounded-[24px] border border-[var(--border-soft)] bg-[#FDFCFB] shadow-[var(--shadow-soft)] z-40 p-4">
        <div className="text-lg font-semibold mb-8 px-2 tracking-tight" style={{ color: 'var(--text-primary)' }}>PifPaf</div>
        <nav className="flex-1 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-btn)] text-sm font-medium transition-colors ${
                  active ? '' : 'hover:bg-white/80'
                }`}
                style={{
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: active ? 'var(--pink-bg)' : undefined,
                  boxShadow: active ? 'inset 0 0 0 1px var(--border-soft)' : undefined,
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.25 : 2} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-0.5 border-t border-[var(--border-soft)] pt-4">
          <Link
            href="/account"
            className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-[var(--radius-btn)] transition-colors ${
              accountActive ? '' : 'hover:bg-white/80'
            }`}
            style={{
              color: accountActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: accountActive ? 'var(--pink-bg)' : undefined,
            }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--lavender)' }}>
              <User size={14} />
            </div>
            <span className="truncate">{profile?.display_name || 'Профиль'}</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 text-sm w-full rounded-[var(--radius-btn)] hover:bg-white/80 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#FDFCFB] border-t border-[var(--border-soft)] z-40 flex justify-around py-2 safe-area-pb">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 text-xs py-1"
              style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 text-xs py-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          <LogOut size={20} />
          Выйти
        </button>
      </nav>
    </>
  );
}
