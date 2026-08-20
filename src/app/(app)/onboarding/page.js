'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AtSign } from 'lucide-react';
import ReelsSyncProgress from '@/components/ReelsSyncProgress';

export default function OnboardingPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
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
        body: JSON.stringify({ input }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Не удалось подключить');
        setLoading(false);
        return;
      }

      setResult(data.summary);
      setTimeout(() => router.push('/dashboard'), 1800);
    } catch {
      setError('Ошибка сети. Попробуй снова.');
      setLoading(false);
    }
  }

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
              Получено {result.imported ?? result.newCount ?? 0} Reels — открываем dashboard…
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
      <h1 className="text-2xl font-semibold mb-2">Подключи свой Instagram ✨</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Вставь ссылку на профиль — мы сами найдём твои Reels за последние 12 месяцев и соберём аналитику.
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full py-3 rounded-[var(--radius-btn)] text-sm font-medium text-white"
          style={{ background: '#191716' }}
        >
          Подключить Instagram
        </button>
      </form>
      <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-secondary)' }}>
        Период импорта: последние 12 месяцев
      </p>
    </div>
  );
}
