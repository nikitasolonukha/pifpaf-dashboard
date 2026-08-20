'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needConfirmEmail, setNeedConfirmEmail] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNeedConfirmEmail(false);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // When email confirmation is required, Supabase returns no active session.
      if (data?.session) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setNeedConfirmEmail(true);
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>PifPaf AI</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Создай аккаунт блогера</p>
        </div>
        {needConfirmEmail ? (
          <div className="p-6 rounded-[var(--radius-lg)] shadow-sm" style={{ background: 'var(--surface)' }}>
            <h2 className="text-lg font-semibold mb-2">Проверь почту ✨</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Мы отправили ссылку для подтверждения аккаунта. После подтверждения можно войти в кабинет.
            </p>
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full py-2.5 rounded-[var(--radius-btn)] text-sm font-medium text-white"
                style={{ background: '#191716' }}
              >
                Перейти к входу
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 rounded-[var(--radius-lg)] shadow-sm" style={{ background: 'var(--surface)' }}>
            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Имя</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-[var(--radius-btn)] border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 mb-4"
              required
            />
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
              minLength={6}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-[var(--radius-btn)] text-sm font-medium text-white transition-opacity disabled:opacity-60"
              style={{ background: '#191716' }}
            >
              {loading ? 'Создаём...' : 'Создать аккаунт'}
            </button>
          </form>
        )}
        {!needConfirmEmail && (
          <p className="text-center text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>
            Уже есть аккаунт?{' '}
            <Link href="/login" className="font-medium underline" style={{ color: 'var(--text-primary)' }}>Войти</Link>
          </p>
        )}
      </div>
    </div>
  );
}
