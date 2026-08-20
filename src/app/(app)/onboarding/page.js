'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AtSign } from 'lucide-react';
import ReelsSyncProgress from '@/components/ReelsSyncProgress';
import SyncPeriodSelect from '@/components/SyncPeriodSelect';
import { DEFAULT_SYNC_PERIOD, getSyncPeriod } from '@/lib/instagram/syncPeriods.mjs';

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAddProfile = searchParams.get('add') === '1';
  const [input, setInput] = useState('');
  const [period, setPeriod] = useState(DEFAULT_SYNC_PERIOD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!loading || result) return undefined;
    const t = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading, result]);

  async function handleConnect(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setElapsedSec(0);

    try {
      const res = await fetch('/api/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, period }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Не удалось подключить');
        setLoading(false);
        return;
      }

      setResult(data.summary);
      setTimeout(() => router.push(isAddProfile ? '/account' : '/dashboard'), 1800);
    } catch {
      setError('Ошибка сети. Попробуй снова.');
      setLoading(false);
    }
  }

  const periodLabel = getSyncPeriod(period).label;

  if (loading || result) {
    return (
      <div
        className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] p-8 shadow-[var(--shadow-soft)] text-center"
        style={{ background: 'var(--surface)' }}
      >
        <div className="w-14 h-14 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: 'var(--pink-bg)' }}>
          <AtSign size={28} style={{ color: 'var(--text-secondary)' }} />
        </div>
        {result ? (
          <>
            <h1 className="text-xl font-semibold mb-2">Готово ✨</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Получено {result.imported ?? result.newCount ?? 0} Reels — открываем кабинет…
            </p>
          </>
        ) : (
          <ReelsSyncProgress
            variant="card"
            active
            elapsedSec={elapsedSec}
            title="Подключаем Instagram…"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] p-8 shadow-[var(--shadow-soft)]"
      style={{ background: 'var(--surface)' }}
    >
      <div className="w-14 h-14 rounded-2xl mb-6 flex items-center justify-center" style={{ background: 'var(--lavender)' }}>
        <AtSign size={28} style={{ color: 'var(--text-secondary)' }} />
      </div>
      <h1 className="text-2xl font-semibold mb-2">
        {isAddProfile ? 'Добавь Instagram-профиль ✨' : 'Подключи Instagram-профиль ✨'}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        {isAddProfile
          ? 'Вставь ссылку на ещё один профиль — выбери период, и Reels появятся отдельно в кабинете.'
          : 'Вставь ссылку на профиль и выбери, за какой период забрать Reels.'}
      </p>
      <form onSubmit={handleConnect} className="space-y-4">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="https://instagram.com/username"
          className="w-full px-4 py-3 rounded-[var(--radius-btn)] border border-[var(--border-soft)] text-sm focus:outline-none focus:ring-2 focus:ring-pink-200"
          required
        />
        <div>
          <label htmlFor="sync-period" className="block text-sm font-medium mb-1.5">
            Период синхронизации
          </label>
          <SyncPeriodSelect
            id="sync-period"
            value={period}
            onChange={setPeriod}
            className="w-full"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full py-3 rounded-[var(--radius-btn)] text-sm font-medium text-white"
          style={{ background: '#191716' }}
        >
          {isAddProfile ? 'Добавить профиль' : 'Подключить Instagram'}
        </button>
      </form>
      <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-secondary)' }}>
        Импортируем Reels за последние {periodLabel.toLowerCase()}
      </p>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="h-64 rounded-[var(--radius-lg)] bg-gray-100 animate-pulse" />}>
      <OnboardingForm />
    </Suspense>
  );
}
