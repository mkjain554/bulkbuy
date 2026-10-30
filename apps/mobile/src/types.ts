export interface User {
  id: string;
  name: string;
  email: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
}

export interface Pool {
  id: string;
  title: string;
  description: string;
  groupPrice: string;
  regularPrice: string;
  minBuyers: number;
  maxParticipants: number | null;
  closesAt: string;
  status: string;
  product: {
    name: string;
    brand: string;
    description: string;
    category: { name: string };
    seller: { name: string };
  };
  formFields: Array<{
    id: string;
    label: string;
    type: 'TEXT' | 'DROPDOWN' | 'DATE';
    required: boolean;
    config: {
      placeholder?: string;
      options?: string[];
      minDate?: string;
      maxDate?: string;
      helpText?: string;
    };
  }>;
  _count: { participations: number };
}

export interface Participation {
  id: string;
  pool: Pool;
  values: Array<{ value: string | null; field: { label: string } }>;
}
