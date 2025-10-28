-- This policy allows anyone (including unauthenticated users) to read data from the 'quotes' table.
-- This is necessary for the public quote view page (/quote/view/:id) to function correctly.
-- The USING (true) clause means this policy applies to all rows for all users for SELECT operations.

-- Drop the policy if it already exists to ensure a clean update.
DROP POLICY IF EXISTS "Enable public read access for all users" ON public.quotes;

-- Create the policy for SELECT (read) operations.
CREATE POLICY "Enable public read access for all users"
ON public.quotes
FOR SELECT
USING (true);