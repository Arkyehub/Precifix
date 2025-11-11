CREATE TABLE public.operational_cost_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  operational_cost_id UUID REFERENCES public.operational_costs(id) ON DELETE CASCADE NOT NULL,
  due_date DATE NOT NULL,
  paid_value NUMERIC NOT NULL,
  paid_date DATE NOT NULL,
  is_paid BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.operational_cost_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own operational cost payments" ON public.operational_cost_payments
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own operational cost payments" ON public.operational_cost_payments
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own operational cost payments" ON public.operational_cost_payments
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own operational cost payments" ON public.operational_cost_payments
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Adiciona uma restrição única para evitar pagamentos duplicados para a mesma instância
ALTER TABLE public.operational_cost_payments ADD CONSTRAINT unique_operational_cost_payment UNIQUE (operational_cost_id, due_date);