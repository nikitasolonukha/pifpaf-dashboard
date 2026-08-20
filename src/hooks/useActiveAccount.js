'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'pifpaf_active_instagram_account_id';

function readStoredId() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readUrlId() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('account');
}

function writeStoredId(id) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('pifpaf-account-change'));
}

function subscribe(cb) {
  window.addEventListener('storage', cb);
  window.addEventListener('pifpaf-account-change', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener('pifpaf-account-change', cb);
    window.removeEventListener('popstate', cb);
  };
}

function getSnapshot() {
  return readUrlId() || readStoredId();
}

/**
 * Active Instagram account id for the cabinet (localStorage + optional URL ?account=).
 */
export function useActiveAccountId(accounts = []) {
  const preferred = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const activeId = (() => {
    if (!accounts?.length) return preferred || null;
    if (preferred && accounts.some((a) => a.id === preferred)) return preferred;
    return accounts[0].id;
  })();

  const setActiveAccountId = useCallback((id) => {
    writeStoredId(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set('account', id);
      else url.searchParams.delete('account');
      window.history.replaceState({}, '', url.pathname + url.search);
      window.dispatchEvent(new Event('pifpaf-account-change'));
    }
  }, []);

  // Persist resolved fallback so reloads stay stable
  useEffect(() => {
    if (!activeId) return;
    if (readStoredId() === activeId) return;
    writeStoredId(activeId);
  }, [activeId]);

  return { activeAccountId: activeId, setActiveAccountId };
}

export function accountQuery(accountId) {
  return accountId ? `accountId=${encodeURIComponent(accountId)}` : '';
}

export function withAccountParam(path, accountId) {
  if (!accountId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}accountId=${encodeURIComponent(accountId)}`;
}
