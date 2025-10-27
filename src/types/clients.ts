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
  zip_code: string | null; // Adicionado zip_code
  created_at: string;
}