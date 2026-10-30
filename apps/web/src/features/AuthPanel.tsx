import { useState, type FormEvent } from 'react';
import { errorMessage, mutate } from '../services/api';
import type { User } from '../types';

export function AuthPanel({
  onSuccess,
  onClose,
}: {
  onSuccess: (user: User) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'BUYER' | 'SELLER'>('BUYER');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const result =
        mode === 'login'
          ? await mutate<{ user: User }>('post', '/auth/login', {
              email: body.email,
              password: body.password,
            })
          : await mutate<{ user: User }>('post', '/auth/register', {
              name: body.name,
              email: body.email,
              password: body.password,
              role,
            });
      onSuccess(result.user);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-700">
              WELCOME TO BULKBUY
            </p>
            <h2 id="auth-title" className="mt-2 text-2xl font-bold">
              {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label className="block text-sm font-medium">
                Name
                <input
                  required
                  minLength={2}
                  name="name"
                  autoComplete="name"
                  className="mt-1 w-full rounded-lg border-slate-300"
                />
              </label>
              <label className="block text-sm font-medium">
                I am joining as
                <select
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as 'BUYER' | 'SELLER')
                  }
                  className="mt-1 w-full rounded-lg border-slate-300"
                >
                  <option value="BUYER">Buyer</option>
                  <option value="SELLER">Seller</option>
                </select>
              </label>
            </>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              required
              type="email"
              name="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border-slate-300"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              required
              type="password"
              name="password"
              minLength={mode === 'register' ? 12 : 1}
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              className="mt-1 w-full rounded-lg border-slate-300"
            />
            {mode === 'register' && (
              <span className="mt-1 block text-xs font-normal text-slate-500">
                At least 12 characters with uppercase, lowercase, and a number.
              </span>
            )}
          </label>
          {message && (
            <p
              role="alert"
              className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
            >
              {message}
            </p>
          )}
          <button
            disabled={busy}
            className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
          >
            {busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">
          {mode === 'login' ? 'New to BulkBuy?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMessage('');
              setMode(mode === 'login' ? 'register' : 'login');
            }}
            className="font-semibold text-indigo-700 hover:underline"
          >
            {mode === 'login' ? 'Create account' : 'Sign in'}
          </button>
        </p>
      </section>
    </div>
  );
}
