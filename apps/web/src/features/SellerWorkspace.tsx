import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage, api, mutate } from '../services/api';
import type { Category, Pool, Product } from '../types';
import { money } from '../utils/money';
import { FormFieldsEditor } from './FormFieldsEditor';
import {
  draftFromSaved,
  serializeFields,
  type FormFieldDraft,
} from './formFields';

export function SellerWorkspace({
  categories,
  onUpdated,
  onParticipants,
}: {
  categories: Category[];
  onUpdated: () => void;
  onParticipants: (pool: Pool) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<FormFieldDraft[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingFormPoolId, setEditingFormPoolId] = useState<string | null>(
    null,
  );

  async function loadMine() {
    try {
      const [productResponse, poolResponse] = await Promise.all([
        api.get<{ products: Product[] }>('/products/mine'),
        api.get<{ pools: Pool[] }>('/pools/mine'),
      ]);
      setProducts(productResponse.data.products);
      setPools(poolResponse.data.pools);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }
  useEffect(() => {
    void loadMine();
  }, []);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = Object.fromEntries(form.entries());
    try {
      const sku = String(body.sku ?? '').trim();
      const imageUrl = String(body.imageUrl ?? '').trim();
      await mutate(
        editingProduct ? 'patch' : 'post',
        editingProduct ? `/products/${editingProduct.id}` : '/products',
        {
          name: body.name,
          brand: body.brand,
          description: body.description,
          categoryId: String(body.categoryId),
          ...(sku ? { sku } : {}),
          ...(imageUrl ? { imageUrl } : {}),
        },
      );
      formElement.reset();
      setMessage(editingProduct ? 'Product updated.' : 'Product created.');
      setEditingProduct(null);
      await loadMine();
      onUpdated();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function createPool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = Object.fromEntries(form.entries());
    try {
      const created = await mutate<{ pool: Pool }>('post', '/pools', {
        productId: body.productId,
        title: body.title,
        description: body.description,
        regularPrice: String(body.regularPrice),
        groupPrice: String(body.groupPrice),
        minBuyers: Number(body.minBuyers),
        maxParticipants: body.maxParticipants
          ? Number(body.maxParticipants)
          : null,
        startsAt: new Date(String(body.startsAt)).toISOString(),
        closesAt: new Date(String(body.closesAt)).toISOString(),
        fields: serializeFields(fields),
      });
      await mutate('post', `/pools/${created.pool.id}/publish`);
      setMessage(`Pool created: ${created.pool.title}`);
      setFields([]);
      formElement.reset();
      await loadMine();
      onUpdated();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const defaultClose = toLocalDateTime(new Date(Date.now() + 7 * 86400000));
  const defaultStart = toLocalDateTime(new Date(Date.now() - 60000));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
          Seller workspace
        </p>
        <h2 className="mt-1 text-2xl font-bold">Build your group offer</h2>
        <p className="mt-2 text-sm text-slate-600">
          Create a product first, then set the group terms and any information
          you need from buyers. No online payments are collected.
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-800"
        >
          {message}
        </p>
      )}
      <section className="grid gap-6 lg:grid-cols-2">
        <form
          key={editingProduct?.id ?? 'new-product'}
          onSubmit={createProduct}
          className="space-y-4 rounded-2xl border bg-white p-6"
        >
          <h3 className="text-lg font-bold">
            1. {editingProduct ? 'Edit product' : 'Create a product'}
          </h3>
          <Input
            name="name"
            label="Product name"
            required
            defaultValue={editingProduct?.name}
          />
          <Input
            name="brand"
            label="Brand name"
            required
            defaultValue={editingProduct?.brand}
          />
          <Input
            name="description"
            label="Description"
            required
            as="textarea"
            defaultValue={editingProduct?.description}
          />
          <label className="block text-sm font-medium">
            Category
            <select
              name="categoryId"
              required
              defaultValue={editingProduct?.category.id ?? ''}
              className="mt-1 w-full rounded-lg border-slate-300"
            >
              <option value="">Choose category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            name="sku"
            label="SKU / model (optional)"
            defaultValue={editingProduct?.sku ?? ''}
          />
          <Input
            name="imageUrl"
            label="Image URL (optional)"
            type="url"
            defaultValue={editingProduct?.imageUrl ?? ''}
          />
          <button
            disabled={busy || categories.length === 0}
            className="rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {editingProduct ? 'Update product' : 'Save product'}
          </button>
          {editingProduct && (
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="ml-3 text-sm font-semibold text-slate-600"
            >
              Stop editing
            </button>
          )}
        </form>

        <form
          onSubmit={createPool}
          className="space-y-4 rounded-2xl border bg-white p-6"
        >
          <h3 className="text-lg font-bold">2. Create a group pool</h3>
          <label className="block text-sm font-medium">
            Product
            <select
              name="productId"
              required
              className="mt-1 w-full rounded-lg border-slate-300"
            >
              <option value="">Choose your product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <Input name="title" label="Offer title" required minLength={3} />
          <Input
            name="description"
            label="Offer details"
            required
            as="textarea"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="regularPrice"
              label="Regular price (₹)"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
            <Input
              name="groupPrice"
              label="Group price (₹)"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
            <Input
              name="minBuyers"
              label="Minimum buyers"
              type="number"
              min="1"
              required
            />
            <Input
              name="maxParticipants"
              label="Capacity (optional)"
              type="number"
              min="1"
            />
            <Input
              name="startsAt"
              label="Starts"
              type="datetime-local"
              defaultValue={defaultStart}
              required
            />
            <Input
              name="closesAt"
              label="Closes"
              type="datetime-local"
              defaultValue={defaultClose}
              required
            />
          </div>
          <div className="border-t pt-4">
            <FormFieldsEditor fields={fields} onChange={setFields} />
          </div>
          <button
            disabled={busy || products.length === 0}
            className="rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            Publish group pool
          </button>
        </form>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h3 className="text-lg font-bold">Your products</h3>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Create your first product to publish a group pool.
          </p>
        ) : (
          <div className="mt-3 divide-y">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-slate-500">
                    {product.brand} · {product.category.name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void archiveProduct(product)}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Your pools</h3>
          <button
            onClick={() => void loadMine()}
            className="text-sm font-semibold text-indigo-700"
          >
            Refresh
          </button>
        </div>
        {pools.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Your created pools will appear here.
          </p>
        ) : (
          <div className="mt-4 divide-y">
            {pools.map((pool) => (
              <div key={pool.id} className="border-b py-3 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{pool.title}</p>
                    <p className="text-sm text-slate-500">
                      {pool.product.name} · {money(pool.groupPrice)} advertised
                      · {pool._count.participations} participants ·{' '}
                      {pool.status.toLowerCase().replaceAll('_', ' ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pool.status === 'DRAFT' && (
                      <button
                        onClick={() => void runPoolAction(pool, 'publish')}
                        className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Publish
                      </button>
                    )}
                    {['TARGET_REACHED', 'FAILED'].includes(pool.status) && (
                      <button
                        onClick={() => void runPoolAction(pool, 'close')}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                      >
                        Confirm next step
                      </button>
                    )}
                    {['DRAFT', 'SCHEDULED', 'ACTIVE'].includes(pool.status) &&
                      pool._count.participations === 0 && (
                        <>
                          <button
                            onClick={() =>
                              setEditingFormPoolId(
                                editingFormPoolId === pool.id ? null : pool.id,
                              )
                            }
                            className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700"
                          >
                            {editingFormPoolId === pool.id
                              ? 'Hide form editor'
                              : 'Edit buyer form'}
                          </button>
                          <button
                            onClick={() => void runPoolAction(pool, 'cancel')}
                            className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    <button
                      onClick={() => onParticipants(pool)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Participants
                    </button>
                  </div>
                </div>
                {editingFormPoolId === pool.id && (
                  <ExistingFormEditor
                    key={`${pool.id}:${pool.updatedAt}`}
                    pool={pool}
                    onCancel={() => setEditingFormPoolId(null)}
                    onSaved={async () => {
                      setEditingFormPoolId(null);
                      await loadMine();
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  async function runPoolAction(
    pool: Pool,
    action: 'publish' | 'close' | 'cancel',
  ) {
    try {
      await mutate('post', `/pools/${pool.id}/${action}`);
      setMessage(
        action === 'close'
          ? 'Seller-confirmed next step recorded. No payment was collected.'
          : `Pool ${action === 'publish' ? 'published' : 'cancelled'}.`,
      );
      await loadMine();
      onUpdated();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function archiveProduct(product: Product) {
    try {
      await mutate('delete', `/products/${product.id}`);
      setMessage(`Archived ${product.name}.`);
      await loadMine();
      onUpdated();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }
}

function ExistingFormEditor({
  pool,
  onCancel,
  onSaved,
}: {
  pool: Pool;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [fields, setFields] = useState(() => draftFromSaved(pool.formFields));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      await mutate('put', `/pools/${pool.id}/form`, {
        fields: serializeFields(fields),
      });
      await onSaved();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <FormFieldsEditor fields={fields} onChange={setFields} />
      {message && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {message}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save buyer form'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ParticipantsPanel({ pool }: { pool: Pool }) {
  const [participants, setParticipants] = useState<Array<{
    id: string;
    buyer: { name: string };
    values: Array<{ value: string | null; field: { label: string } }>;
  }> | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    api
      .get(`/pools/${pool.id}/participants`)
      .then(({ data }) => setParticipants(data.participants))
      .catch((error: unknown) => setMessage(errorMessage(error)));
  }, [pool.id]);

  return (
    <section className="rounded-2xl border bg-white p-6">
      <h3 className="text-xl font-bold">Participants · {pool.title}</h3>
      <p className="mt-1 text-sm text-slate-500">
        Personal responses are visible to you as the pool owner only.
      </p>
      {message && (
        <p role="alert" className="mt-4 text-sm text-rose-700">
          {message}
        </p>
      )}
      {participants === null ? (
        <p className="mt-5 text-sm text-slate-500">Loading participants…</p>
      ) : participants.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">No participants yet.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {participants.map((participant) => (
            <article
              key={participant.id}
              className="rounded-xl bg-slate-50 p-4"
            >
              <h4 className="font-semibold">{participant.buyer.name}</h4>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {participant.values.map(({ field, value }) => (
                  <div key={field.label}>
                    <dt className="text-xs text-slate-500">{field.label}</dt>
                    <dd className="text-sm">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Input({
  name,
  label,
  as = 'input',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  as?: 'input' | 'textarea';
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {as === 'textarea' ? (
        <textarea
          name={name}
          required={props.required}
          minLength={props.minLength}
          defaultValue={props.defaultValue}
          className="mt-1 w-full rounded-lg border-slate-300"
          rows={3}
        />
      ) : (
        <input
          {...props}
          name={name}
          className="mt-1 w-full rounded-lg border-slate-300"
        />
      )}
    </label>
  );
}

function toLocalDateTime(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
