import { useState, type FormEvent } from 'react';
import { errorMessage, mutate } from '../services/api';
import type { Pool } from '../types';

export function BuyerPoolForm({
  pool,
  onComplete,
}: {
  pool: Pool;
  onComplete: () => void;
}) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      await mutate('post', `/pools/${pool.id}/join`, { responses });
      onComplete();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-4 border-t border-slate-200 pt-5"
    >
      <h3 className="font-bold">Join this group offer</h3>
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Product details · supplied by seller
        </p>
        <p className="font-semibold">{pool.product.name}</p>
        <p className="text-sm text-slate-600">{pool.product.brand}</p>
        <p className="mt-2 text-sm text-slate-600">
          {pool.product.description}
        </p>
      </div>
      {pool.formFields.map((field) => (
        <label key={field.id} className="block text-sm font-medium">
          {field.label}{' '}
          {field.required && <span className="text-rose-600">*</span>}
          {field.type === 'DROPDOWN' ? (
            <select
              required={field.required}
              value={responses[field.id] ?? ''}
              onChange={(event) =>
                setResponses((current) => ({
                  ...current,
                  [field.id]: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border-slate-300"
            >
              <option value="">Select an option</option>
              {(field.config.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : field.type === 'DATE' ? (
            <input
              type="date"
              required={field.required}
              min={field.config.minDate}
              max={field.config.maxDate}
              value={responses[field.id] ?? ''}
              onChange={(event) =>
                setResponses((current) => ({
                  ...current,
                  [field.id]: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border-slate-300"
            />
          ) : (
            <input
              required={field.required}
              maxLength={2000}
              placeholder={field.config.placeholder}
              value={responses[field.id] ?? ''}
              onChange={(event) =>
                setResponses((current) => ({
                  ...current,
                  [field.id]: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border-slate-300"
            />
          )}
          {field.config.helpText && (
            <span className="mt-1 block font-normal text-slate-500">
              {field.config.helpText}
            </span>
          )}
        </label>
      ))}
      {message && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {message}
        </p>
      )}
      <p className="text-xs leading-5 text-slate-500">
        This is a free request to join. No payment is collected. The advertised
        group price is not a guaranteed final offer until confirmed by the
        seller.
      </p>
      <button
        disabled={busy || pool.status !== 'ACTIVE'}
        className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
      >
        {busy ? 'Joining…' : 'Join pool'}
      </button>
    </form>
  );
}
