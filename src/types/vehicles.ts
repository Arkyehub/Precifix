export interface Vehicle {
  id: string;
  client_id: string;
  brand: string;
  model: string;
  plate: string | null;
  year: number;
  created_at: string;
}