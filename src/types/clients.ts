export interface Client {
  id: string;
  user_id: string;
  name: string;
  document_number: string | null; // CPF/CNPJ
  phone_number: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
}