import type { FieldConfig, FormField } from '../types';

export type FormFieldDraft = Omit<FormField, 'id' | 'displayOrder'> & {
  localId: string;
};

export function newField(type: FormField['type']): FormFieldDraft {
  return {
    localId: crypto.randomUUID(),
    label: '',
    type,
    required: false,
    config: type === 'DROPDOWN' ? { options: [''] } : {},
  };
}

export function serializeFields(fields: FormFieldDraft[]) {
  return fields.map((field) => ({
    label: field.label,
    type: field.type,
    required: field.required,
    ...(field.type === 'DROPDOWN'
      ? { options: (field.config.options ?? []).filter(Boolean) }
      : field.type === 'TEXT'
        ? {
            ...(field.config.placeholder
              ? { placeholder: field.config.placeholder }
              : {}),
            ...(field.config.helpText
              ? { helpText: field.config.helpText }
              : {}),
          }
        : {
            ...(field.config.minDate ? { minDate: field.config.minDate } : {}),
            ...(field.config.maxDate ? { maxDate: field.config.maxDate } : {}),
          }),
  }));
}

export function draftFromSaved(fields: FormField[]): FormFieldDraft[] {
  return fields.map((field) => ({
    localId: field.id,
    label: field.label,
    type: field.type,
    required: field.required,
    config: field.config as FieldConfig,
  }));
}
