ALTER TABLE public.operational_costs
ADD COLUMN expense_date DATE,
ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN recurrence_frequency TEXT,
ADD COLUMN recurrence_end_date DATE;