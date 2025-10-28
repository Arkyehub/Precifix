-- This policy allows public, read-only access to the 'quotes' table.
-- It is essential for the public quote view page (/quote/view/:quoteId) to function.
-- Without this, anonymous users cannot view quotes.

-- Drop the policy if it already exists to ensure a clean setup.
DROP POLICY IF EXISTS "Allow public read access to quotes" ON public.quotes;

-- Create the policy.
CREATE POLICY "Allow public read access to quotes"
ON public.quotes
FOR SELECT
USING (true);