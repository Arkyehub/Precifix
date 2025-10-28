-- FIX: This script removes a dangerous and conflicting UPDATE policy
-- that allows anonymous users to modify quotes. This is a security risk
-- and is likely interfering with the correct SELECT policy.

DROP POLICY IF EXISTS "Policy with table joins" ON public.quotes;