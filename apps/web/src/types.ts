export type Role = 'BUYER' | 'SELLER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export type FieldConfig = {
  placeholder?: string;
  helpText?: string;
  options?: string[];
  minDate?: string;
  maxDate?: string;
};

export interface FormField {
  id: string;
  label: string;
  type: 'TEXT' | 'DROPDOWN' | 'DATE';
  required: boolean;
  config: FieldConfig;
  displayOrder: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string;
  sku?: string | null;
  imageUrl: string | null;
  category: Category;
  seller?: { id: string; name: string };
}

export interface Pool {
  id: string;
  title: string;
  description: string;
  regularPrice: string;
  groupPrice: string;
  currency: string;
  minBuyers: number;
  maxParticipants: number | null;
  startsAt: string;
  closesAt: string;
  updatedAt: string;
  status: string;
  product: Product;
  formFields: FormField[];
  _count: { participations: number };
}

export interface Participation {
  id: string;
  createdAt: string;
  pool: Pool;
  values: Array<{
    value: string | null;
    field: FormField;
  }>;
}
