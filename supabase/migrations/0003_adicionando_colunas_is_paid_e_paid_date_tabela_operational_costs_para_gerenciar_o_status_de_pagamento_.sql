ALTER TABLE public.operational_costs
ADD COLUMN is_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN paid_date DATE;