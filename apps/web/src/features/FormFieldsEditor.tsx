import { useState } from 'react';
import type { FieldConfig, FormField } from '../types';
import { newField, type FormFieldDraft } from './formFields';

export function FormFieldsEditor({
  fields,
  onChange,
}: {
  fields: FormFieldDraft[];
  onChange: (fields: FormFieldDraft[]) => void;
}) {
  const [preview, setPreview] = useState(false);

  function updateField(localId: string, updates: Partial<FormFieldDraft>) {
    onChange(
      fields.map((field) =>
        field.localId === localId ? { ...field, ...updates } : field,
      ),
    );
  }

  function updateConfig(
    localId: string,
    key: keyof FieldConfig,
    value: string,
  ) {
    const field = fields.find((entry) => entry.localId === localId);
    if (!field) return;
    const config = { ...field.config };
    if (value) {
      Object.assign(config, { [key]: value });
    } else {
      delete config[key];
    }
    updateField(localId, { config });
  }

  function moveField(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    const reordered = [...fields];
    [reordered[index], reordered[nextIndex]] = [
      reordered[nextIndex]!,
      reordered[index]!,
    ];
    onChange(reordered);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-semibold">Buyer form fields</h4>
          <p className="text-xs text-slate-500">
            Product name, brand, and description are shown read-only.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPreview((current) => !current)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            {preview ? 'Edit fields' : 'Preview'}
          </button>
          {!preview && (
            <select
              aria-label="Add custom field"
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  onChange([
                    ...fields,
                    newField(event.target.value as FormField['type']),
                  ]);
                }
              }}
              className="rounded-lg border-slate-300 text-sm"
            >
              <option value="">Add field…</option>
              <option value="TEXT">Text</option>
              <option value="DROPDOWN">Dropdown</option>
              <option value="DATE">Date</option>
            </select>
          )}
        </div>
      </div>
      {preview ? (
        <div className="mt-4 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Buyer preview
          </p>
          {fields.length === 0 ? (
            <p className="text-sm text-slate-600">
              No custom questions have been added.
            </p>
          ) : (
            fields.map((field) => (
              <div key={field.localId}>
                <p className="text-sm font-semibold">
                  {field.label || 'Untitled field'} {field.required ? '*' : ''}
                </p>
                <p className="text-xs text-slate-500">
                  {field.type === 'DROPDOWN'
                    ? (field.config.options ?? [])
                        .filter(Boolean)
                        .join(' · ') || 'Add at least one dropdown option'
                    : field.type === 'DATE'
                      ? 'Date response'
                      : field.config.placeholder || 'Text response'}
                </p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {fields.map((field, index) => (
            <div key={field.localId} className="rounded-xl bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  {index + 1}. {field.type.toLowerCase()}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Move field ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => moveField(index, -1)}
                    className="rounded px-2 py-1 text-slate-600 hover:bg-white disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move field ${index + 1} down`}
                    disabled={index === fields.length - 1}
                    onClick={() => moveField(index, 1)}
                    className="rounded px-2 py-1 text-slate-600 hover:bg-white disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        fields.filter(
                          (entry) => entry.localId !== field.localId,
                        ),
                      )
                    }
                    className="text-xs font-semibold text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <input
                required
                aria-label="Field label"
                value={field.label}
                onChange={(event) =>
                  updateField(field.localId, { label: event.target.value })
                }
                placeholder="Field label"
                className="w-full rounded-lg border-slate-300 text-sm"
              />
              {field.type === 'TEXT' && (
                <>
                  <input
                    aria-label="Placeholder"
                    value={field.config.placeholder ?? ''}
                    onChange={(event) =>
                      updateConfig(
                        field.localId,
                        'placeholder',
                        event.target.value,
                      )
                    }
                    placeholder="Placeholder (optional)"
                    className="mt-2 w-full rounded-lg border-slate-300 text-sm"
                  />
                  <input
                    aria-label="Help text"
                    value={field.config.helpText ?? ''}
                    onChange={(event) =>
                      updateConfig(
                        field.localId,
                        'helpText',
                        event.target.value,
                      )
                    }
                    placeholder="Help text (optional)"
                    className="mt-2 w-full rounded-lg border-slate-300 text-sm"
                  />
                </>
              )}
              {field.type === 'DROPDOWN' && (
                <textarea
                  aria-label="Dropdown options"
                  value={(field.config.options ?? []).join('\n')}
                  onChange={(event) =>
                    updateField(field.localId, {
                      config: {
                        ...field.config,
                        options: event.target.value
                          .split('\n')
                          .map((option) => option.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                  placeholder="One option per line"
                  rows={3}
                  className="mt-2 w-full rounded-lg border-slate-300 text-sm"
                />
              )}
              {field.type === 'DATE' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    aria-label="Minimum date"
                    value={field.config.minDate ?? ''}
                    onChange={(event) =>
                      updateConfig(field.localId, 'minDate', event.target.value)
                    }
                    className="rounded-lg border-slate-300 text-sm"
                  />
                  <input
                    type="date"
                    aria-label="Maximum date"
                    value={field.config.maxDate ?? ''}
                    onChange={(event) =>
                      updateConfig(field.localId, 'maxDate', event.target.value)
                    }
                    className="rounded-lg border-slate-300 text-sm"
                  />
                </div>
              )}
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) =>
                    updateField(field.localId, {
                      required: event.target.checked,
                    })
                  }
                  className="rounded border-slate-300 text-indigo-700"
                />
                Required
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
