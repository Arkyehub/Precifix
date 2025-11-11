export interface OperationalCost {
  id: string;
  description: string;
  value: number;
  type: 'fixed' | 'variable';
  user_id: string;
  created_at: string;
  expense_date?: string; // Data da despesa
  is_recurring?: boolean; // Se é recorrente
  recurrence_frequency?: 'none' | 'daily' | 'weekly' | 'monthly'; // Frequência da recorrência
  recurrence_end_date?: string; // YYYY-MM-DD
  is_paid?: boolean;
  paid_date?: string; // YYYY-MM-DD
}

export interface OperationalCostPayment {
  id: string;
  user_id: string;
  operational_cost_id: string;
  due_date: string; // YYYY-MM-DD
  paid_value: number;
  paid_date: string; // YYYY-MM-DD
  is_paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface OperationalHours {
  id?: string;
  user_id: string;
  monday_start: string;
  monday_end: string;
  tuesday_start: string;
  tuesday_end: string;
  wednesday_start: string;
  wednesday_end: string;
  thursday_start: string;
  thursday_end: string;
  friday_start: string;
  friday_end: string;
  saturday_start: string;
  saturday_end: string;
  sunday_start: string;
  sunday_end: string;
}

export const daysOfWeek = [
  { key: 'monday', label: 'Seg' },
  { key: 'tuesday', label: 'Ter' },
  { key: 'wednesday', label: 'Qua' },
  { key: 'thursday', label: 'Qui' },
  { key: 'friday', label: 'Sex' },
  { key: 'saturday', label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
];