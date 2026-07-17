'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.error === 'invalid_credentials' ? 'Špatný email nebo heslo.' : 'Něco se pokazilo. Zkus to znovu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 animate-fade-in">
      <div className="text-center mb-10">
        <span className="text-6xl block mb-3">💪</span>
        <h1 className="text-3xl font-bold text-slate-900">FitCoach</h1>
        <p className="text-slate-500 mt-1">Tvůj osobní AI trenér a výživový poradce</p>
      </div>

      <form onSubmit={submit} className="space-y-4 mb-6">
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="tomas@email.cz" autoComplete="email" autoFocus />
        </div>
        <div>
          <label className="label">Heslo</label>
          <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" autoComplete="current-password" />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading || !email || !password} className="btn-primary w-full">
          {loading ? 'Přihlašuji...' : 'Přihlásit se'}
        </button>
      </form>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">nebo</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <button onClick={() => router.push('/auth/register')} className="btn-outline w-full">
        Vytvořit účet
      </button>

      <p className="text-[11px] text-slate-400 text-center mt-8">
        Aplikace neposkytuje lékařské rady. Před začátkem cvičebního programu se poraďte s lékařem.
      </p>
    </div>
  );
}
