import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CircleUserRound,
  LogOut,
  Search,
  ShoppingBag,
} from 'lucide-react';
import { api, errorMessage, mutate } from '../services/api';
import { PoolCard } from '../components/PoolCard';
import { StatusPill } from '../components/StatusPill';
import { money } from '../utils/money';
import { AuthPanel } from '../features/AuthPanel';
import { BuyerPoolForm } from '../features/BuyerPoolForm';
import {
  ParticipantsPanel,
  SellerWorkspace,
} from '../features/SellerWorkspace';
import type { Category, Participation, Pool, User } from '../types';

type View = 'marketplace' | 'buyer' | 'seller' | 'admin';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [participantsPool, setParticipantsPool] = useState<Pool | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [view, setView] = useState<View>('marketplace');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notifications, setNotifications] = useState(0);

  const loadCatalog = useCallback(async () => {
    setError('');
    try {
      const [categoryResponse, poolResponse] = await Promise.all([
        api.get<{ categories: Category[] }>('/categories'),
        api.get<{ pools: Pool[] }>('/pools', {
          params: { search: search || undefined, pageSize: 24 },
        }),
      ]);
      setCategories(categoryResponse.data.categories);
      setPools(poolResponse.data.pools);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadBuyerData = useCallback(async () => {
    if (user?.role !== 'BUYER') return;
    try {
      const { data } = await api.get<{ participations: Participation[] }>(
        '/users/me/participations',
      );
      setParticipations(data.participations);
    } catch (reason) {
      setNotice(errorMessage(reason));
    }
  }, [user]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get<{
        notifications: Array<{ readAt: string | null }>;
      }>('/notifications');
      setNotifications(
        data.notifications.filter((item) => !item.readAt).length,
      );
    } catch {
      setNotifications(0);
    }
  }, [user]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    api
      .get<{ user: User }>('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void loadBuyerData();
    void loadNotifications();
  }, [loadBuyerData, loadNotifications]);

  const filteredPools = useMemo(
    () =>
      categoryId
        ? pools.filter((pool) => pool.product.category.id === categoryId)
        : pools,
    [categoryId, pools],
  );
  const bestPool = pools[0];

  async function signOut() {
    try {
      await mutate('post', '/auth/logout');
      setUser(null);
      setView('marketplace');
      setNotice('You have signed out.');
    } catch (reason) {
      setNotice(errorMessage(reason));
    }
  }

  function onAuthenticated(nextUser: User) {
    setUser(nextUser);
    setShowAuth(false);
    setNotice(`Welcome${nextUser.name ? `, ${nextUser.name}` : ''}!`);
    setView(nextUser.role === 'SELLER' ? 'seller' : 'marketplace');
  }

  async function didJoin() {
    setNotice(
      'You joined the pool. Your request is free; no payment was collected.',
    );
    setSelectedPool(null);
    await Promise.all([loadCatalog(), loadBuyerData()]);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button
            type="button"
            className="flex items-center gap-2 text-xl font-black tracking-tight text-indigo-700"
            onClick={() => {
              setView('marketplace');
              setSelectedPool(null);
            }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-700 text-sm text-white">
              B
            </span>
            BulkBuy
          </button>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <button
              onClick={() => setView('marketplace')}
              className="hover:text-indigo-700"
            >
              Marketplace
            </button>
            {user?.role === 'BUYER' && (
              <button
                onClick={() => setView('buyer')}
                className="hover:text-indigo-700"
              >
                My group buys
              </button>
            )}
            {user?.role === 'SELLER' && (
              <button
                onClick={() => setView('seller')}
                className="hover:text-indigo-700"
              >
                Seller workspace
              </button>
            )}
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setView('admin')}
                className="hover:text-indigo-700"
              >
                Admin
              </button>
            )}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 sm:inline">
                  {user.name} · {user.role.toLowerCase()}
                </span>
                <button
                  type="button"
                  title={`${notifications} unread notifications`}
                  className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                  onClick={() =>
                    setNotice(
                      notifications
                        ? `You have ${notifications} unread notification${notifications === 1 ? '' : 's'}.`
                        : 'You have no unread notifications.',
                    )
                  }
                >
                  <Bell size={19} />
                  {notifications > 0 && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Sign out"
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  <LogOut size={15} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowAuth(true)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuth(true)}
                  className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800"
                >
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
        {notice && (
          <div
            role="status"
            className="mb-5 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900"
          >
            {notice}
            <button aria-label="Dismiss message" onClick={() => setNotice('')}>
              ×
            </button>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}{' '}
            <button
              onClick={() => void loadCatalog()}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {view === 'marketplace' && (
          <>
            <section className="overflow-hidden rounded-3xl bg-indigo-950 text-white">
              <div className="grid gap-8 px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-200">
                    Better deals, built together
                  </p>
                  <h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                    Great things happen when we buy together.
                  </h1>
                  <p className="mt-5 max-w-xl leading-7 text-indigo-100">
                    Join other buyers to help unlock seller-advertised group
                    prices on products you actually want.
                  </p>
                  <a
                    href="#offers"
                    className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-indigo-950 hover:bg-indigo-50"
                  >
                    Explore group offers <ArrowRight size={17} />
                  </a>
                </div>
                <div className="relative hidden min-h-64 items-center justify-center lg:flex">
                  <div className="absolute h-64 w-64 rounded-full bg-indigo-600/50 blur-3xl" />
                  <div className="relative w-full max-w-sm rotate-2 rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-bold text-emerald-200">
                        COMMUNITY OFFER
                      </span>
                      <ShoppingBag className="text-indigo-200" />
                    </div>
                    <p className="mt-10 text-sm text-indigo-200">
                      {bestPool?.product.name ?? 'Your next favorite find'}
                    </p>
                    <p className="mt-1 text-4xl font-black">
                      {bestPool ? money(bestPool.groupPrice) : 'Group pricing'}
                    </p>
                    <div className="mt-6 h-2 rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-emerald-300"
                        style={{
                          width: `${bestPool ? Math.min(100, (bestPool._count.participations / bestPool.minBuyers) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-indigo-200">
                      {bestPool
                        ? `${bestPool._count.participations} people already joined`
                        : 'Real offers from marketplace sellers'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-10" id="offers">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-indigo-700">
                    Discover as a group
                  </p>
                  <h2 className="mt-1 text-3xl font-bold tracking-tight">
                    Current group offers
                  </h2>
                </div>
                <label className="relative block w-full md:max-w-sm">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search products or offers"
                    className="w-full rounded-xl border-slate-300 py-3 pl-10 pr-4"
                  />
                </label>
              </div>
              <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
                <CategoryChip
                  selected={!categoryId}
                  onClick={() => setCategoryId('')}
                  label="All categories"
                />
                {categories.map((category) => (
                  <CategoryChip
                    key={category.id}
                    selected={categoryId === category.id}
                    onClick={() => setCategoryId(category.id)}
                    label={category.name}
                  />
                ))}
              </div>
              {loading ? (
                <p className="py-16 text-center text-slate-500">
                  Loading live offers…
                </p>
              ) : filteredPools.length === 0 ? (
                <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                  <ShoppingBag className="mx-auto text-slate-400" size={30} />
                  <h3 className="mt-3 font-bold">No matching offers yet</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Try another search, or check back as sellers publish new
                    pools.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPools.map((pool) => (
                    <PoolCard
                      key={pool.id}
                      pool={pool}
                      onOpen={setSelectedPool}
                    />
                  ))}
                </div>
              )}
            </section>
            <section className="mt-14 grid gap-4 rounded-3xl border border-slate-200 bg-white p-7 sm:grid-cols-3 sm:p-9">
              <InfoStep
                number="01"
                title="Find your offer"
                text="Browse real products and transparent group terms."
              />
              <InfoStep
                number="02"
                title="Join for free"
                text="Share only the information the seller requests."
              />
              <InfoStep
                number="03"
                title="Unlock together"
                text="The seller confirms the next steps when the target is reached."
              />
            </section>
          </>
        )}

        {view === 'seller' && user?.role === 'SELLER' && (
          <SellerWorkspace
            categories={categories}
            onUpdated={loadCatalog}
            onParticipants={setParticipantsPool}
          />
        )}
        {view === 'buyer' && user?.role === 'BUYER' && (
          <section>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-indigo-700">
                  Buyer dashboard
                </p>
                <h1 className="mt-1 text-3xl font-bold">Your group buys</h1>
              </div>
              <button
                onClick={() => void loadBuyerData()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              >
                Refresh
              </button>
            </div>
            {participations.length === 0 ? (
              <div className="mt-7 rounded-2xl border border-dashed bg-white p-12 text-center">
                <CircleUserRound className="mx-auto text-slate-400" />
                <h2 className="mt-3 font-bold">
                  Your joined pools will appear here
                </h2>
                <button
                  onClick={() => setView('marketplace')}
                  className="mt-4 font-semibold text-indigo-700"
                >
                  Browse marketplace
                </button>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {participations.map((participation) => (
                  <article
                    key={participation.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold">
                          {participation.pool.product.name}
                        </h2>
                        <StatusPill status={participation.pool.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {participation.pool.title} ·{' '}
                        {money(participation.pool.groupPrice)} advertised
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {participation.pool._count.participations} joined ·
                        closes{' '}
                        {new Date(
                          participation.pool.closesAt,
                        ).toLocaleDateString('en-IN')}
                      </p>
                      {participation.values.length > 0 && (
                        <details className="mt-3 text-sm">
                          <summary className="cursor-pointer font-semibold text-indigo-700">
                            Review my responses
                          </summary>
                          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                            {participation.values.map(({ field, value }) => (
                              <div key={field.id}>
                                <dt className="text-xs text-slate-500">
                                  {field.label}
                                </dt>
                                <dd>{value || '—'}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedPool(participation.pool)}
                      className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      View details
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {view === 'admin' && user?.role === 'ADMIN' && <AdminWorkspace />}
        {(view === 'seller' || view === 'buyer' || view === 'admin') &&
          !user && (
            <div className="rounded-2xl bg-white p-10 text-center">
              <h1 className="text-2xl font-bold">Sign in to continue</h1>
              <button
                onClick={() => setShowAuth(true)}
                className="mt-4 rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white"
              >
                Sign in
              </button>
            </div>
          )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-4 py-7 text-sm text-slate-500 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} BulkBuy · Group buying, together.</p>
          <p>Free to join. No online payments are collected.</p>
        </div>
      </footer>
      {showAuth && (
        <AuthPanel
          onSuccess={onAuthenticated}
          onClose={() => setShowAuth(false)}
        />
      )}
      {selectedPool && (
        <PoolDialog
          pool={selectedPool}
          user={user}
          onClose={() => setSelectedPool(null)}
          onNeedAuth={() => {
            setSelectedPool(null);
            setShowAuth(true);
          }}
          onJoined={didJoin}
        />
      )}
      {participantsPool && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/50 p-4 sm:p-8">
          <div className="mx-auto max-w-4xl rounded-2xl bg-slate-50 p-4 sm:p-7">
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setParticipantsPool(null)}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <ParticipantsPanel pool={participantsPool} />
          </div>
        </div>
      )}
    </div>
  );
}

function PoolDialog({
  pool,
  user,
  onClose,
  onNeedAuth,
  onJoined,
}: {
  pool: Pool;
  user: User | null;
  onClose: () => void;
  onNeedAuth: () => void;
  onJoined: () => void;
}) {
  const count = pool._count.participations;
  const targetProgress = Math.min(
    100,
    Math.round((count / pool.minBuyers) * 100),
  );
  const canJoin = pool.status === 'ACTIVE' && user?.role === 'BUYER';
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/50 p-4 sm:p-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pool-dialog-title"
        className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <p className="text-sm font-semibold text-indigo-700">GROUP OFFER</p>
          <button
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {pool.product.brand} · {pool.product.category.name}
              </p>
              <h2 id="pool-dialog-title" className="mt-1 text-2xl font-bold">
                {pool.product.name}
              </h2>
              <p className="mt-1 text-slate-600">{pool.title}</p>
            </div>
            <StatusPill status={pool.status} />
          </div>
          <div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Advertised group price</p>
              <p className="mt-1 text-2xl font-bold">
                {money(pool.groupPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Regular price</p>
              <p className="mt-1 text-xl font-semibold">
                {money(pool.regularPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Seller</p>
              <p className="mt-1 font-semibold">
                {pool.product.seller?.name ?? 'BulkBuy seller'}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-sm">
              <span>{count} participants</span>
              <span>
                {pool.minBuyers} minimum · {pool.maxParticipants ?? 'No'} max
              </span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-700"
                style={{ width: `${targetProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Closes {new Date(pool.closesAt).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="mt-6">
            <h3 className="font-bold">Offer details</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {pool.description}
            </p>
          </div>
          {canJoin ? (
            <BuyerPoolForm pool={pool} onComplete={() => void onJoined()} />
          ) : pool.status !== 'ACTIVE' ? (
            <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              This pool is {pool.status.toLowerCase().replaceAll('_', ' ')} and
              is not accepting new participants.
            </p>
          ) : user ? (
            <p className="mt-6 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
              Sign in with a buyer account to join this pool.
            </p>
          ) : (
            <button
              onClick={onNeedAuth}
              className="mt-6 w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white"
            >
              Sign in or register to join
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function CategoryChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${selected ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'}`}
    >
      {label}
    </button>
  );
}

function InfoStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="p-2">
      <p className="text-sm font-bold text-indigo-700">{number}</p>
      <h3 className="mt-2 font-bold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function AdminWorkspace() {
  const [users, setUsers] = useState<Array<User & { status: string }>>([]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    api
      .get('/admin/users')
      .then(({ data }) => setUsers(data.users))
      .catch((reason: unknown) => setMessage(errorMessage(reason)));
  }, []);
  return (
    <section>
      <p className="text-sm font-bold uppercase tracking-wide text-indigo-700">
        Administration
      </p>
      <h1 className="mt-1 text-3xl font-bold">User accounts</h1>
      {message && (
        <p role="alert" className="mt-4 text-rose-700">
          {message}
        </p>
      )}
      <div className="mt-6 overflow-hidden rounded-2xl border bg-white">
        {users.map((account) => (
          <div
            key={account.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0"
          >
            <div>
              <p className="font-semibold">{account.name}</p>
              <p className="text-sm text-slate-500">
                {account.email} · {account.role}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">{account.status}</span>
              <button
                onClick={() => {
                  const status =
                    account.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                  void mutate<{ user: User & { status: string } }>(
                    'patch',
                    `/admin/users/${account.id}/status`,
                    { status },
                  )
                    .then(({ user: updated }) =>
                      setUsers((current) =>
                        current.map((entry) =>
                          entry.id === updated.id ? updated : entry,
                        ),
                      ),
                    )
                    .catch((reason: unknown) =>
                      setMessage(errorMessage(reason)),
                    );
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              >
                {account.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && !message && (
          <p className="p-6 text-slate-500">Loading users…</p>
        )}
      </div>
    </section>
  );
}
