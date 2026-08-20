'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export default function AddReelModal({ onClose, onSuccess }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [stage, setStage] = useState(null); // null | 'checking' | 'scraping' | 'saving'

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStage('checking');

    try {
      setStage('scraping');
      const res = await fetch('/api/reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Произошла ошибка');
        setStage(null);
        return;
      }

      setStage('saving');
      onSuccess?.();
      onClose();
    } catch {
      setError('Не удалось подключиться к серверу');
      setStage(null);
    }
  }

  const stages = [
    { key: 'checking', label: 'Проверяем ссылку' },
    { key: 'scraping', label: 'Получаем статистику' },
    { key: 'saving', label: 'Добавляем в кабинет' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md p-6 rounded-[var(--radius-lg)] bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Добавить новый Reel</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          Вставь ссылку из Instagram — остальное подтянем сами ✨
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://instagram.com/reel/..."
            className="w-full px-4 py-2.5 rounded-[var(--radius-btn)] border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 mb-4"
            disabled={!!stage}
            required
          />

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          {stage && (
            <div className="space-y-2 mb-4">
              {stages.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <div className={`w-2 h-2 rounded-full ${stage === key ? 'bg-pink-300 animate-pulse' : stages.indexOf(stages.find(s => s.key === key)) < stages.indexOf(stages.find(s => s.key === stage)) ? 'bg-green-300' : 'bg-gray-200'}`} />
                  {label}
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={!!stage}
            className="w-full py-2.5 rounded-[var(--radius-btn)] text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: '#191716' }}
          >
            {stage ? 'Забираем данные из Instagram...' : 'Добавить Reel'}
          </button>
        </form>
      </div>
    </div>
  );
}
