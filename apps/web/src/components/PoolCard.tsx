import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, Users } from 'lucide-react';
import { money } from '../utils/money';
import type { Pool } from '../types';
import { StatusPill } from './StatusPill';

export function PoolCard({
  pool,
  onOpen,
}: {
  pool: Pool;
  onOpen: (pool: Pool) => void;
}) {
  const count = pool._count.participations;
  const progress = Math.min(100, Math.round((count / pool.minBuyers) * 100));
  const savings = Number(pool.regularPrice) - Number(pool.groupPrice);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-48 bg-slate-100">
        {pool.product.imageUrl ? (
          <img
            src={pool.product.imageUrl}
            alt={pool.product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Product image coming soon
          </div>
        )}
        <div className="absolute left-4 top-4">
          <StatusPill status={pool.status} />
        </div>
      </div>
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          {pool.product.brand} · {pool.product.category.name}
        </p>
        <h2 className="mt-2 line-clamp-1 text-lg font-bold text-slate-900">
          {pool.product.name}
        </h2>
        <p className="mt-1 line-clamp-1 text-sm text-slate-500">{pool.title}</p>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-500">Advertised group price</p>
            <p className="text-2xl font-bold text-slate-900">
              {money(pool.groupPrice)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400 line-through">
              {money(pool.regularPrice)}
            </p>
            <p className="text-xs font-medium text-emerald-700">
              Save {money(savings)}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Users size={14} /> {count} joined · {pool.minBuyers} needed
            </span>
            <span>{progress}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress}% of minimum buyers`}
          >
            <div
              className="h-full rounded-full bg-indigo-600"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Ends{' '}
            {formatDistanceToNow(new Date(pool.closesAt), { addSuffix: true })}
          </p>
          <button
            type="button"
            onClick={() => onOpen(pool)}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            View pool <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
