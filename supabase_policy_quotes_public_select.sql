-- FIX: This script resolves multiple conflicting SELECT policies on the 'quotes' table.
-- It ensures that public, anonymous access for quote viewing works correctly.

-- First, drop all existing SELECT policies to avoid conflicts.
DROP POLICY IF EXISTS "Allow public read access to quotes" ON public.quotes;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.quotes;
DROP POLICY IF EXISTS "quotes_select_policy" ON public.quotes;

-- Then, create a single, definitive policy that allows public read access for everyone (anon and authenticated).
-- This is necessary for the public quote view page to function.
CREATE POLICY "Enable public read access for all users"
ON public.quotes
FOR SELECT
USING (true);