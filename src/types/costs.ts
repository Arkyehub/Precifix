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
  recurrence_end_date?: string; // Data final da recorrência
  is_paid?: boolean; // Se o custo foi pago
  paid_date?: string; // Data do pagamento
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