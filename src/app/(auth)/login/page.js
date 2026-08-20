'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Неверный email или пароль');
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>PifPaf AI</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Войди в кабинет блогера</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 rounded-[var(--radius-lg)] shadow-sm" style={{ background: 'var(--surface)' }}>
          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-[var(--radius-btn)] border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 mb-4"
            required
          />
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-[var(--radius-btn)] border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 mb-6"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-[var(--radius-btn)] text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: '#191716' }}
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>
          Нет аккаунта?{' '}
          <Link href="/signup" className="font-medium underline" style={{ color: 'var(--text-primary)' }}>Регистрация</Link>
        </p>
      </div>
    </div>
  );
}
