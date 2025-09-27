-- FIX DELETE PERMISSIONS FOR TICKETS
-- Run this in Supabase Dashboard > SQL Editor

-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'audit_tickets';

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Users can delete tickets" ON public.audit_tickets;
DROP POLICY IF EXISTS "Users can delete their own tickets" ON public.audit_tickets;

-- Create a policy that allows users to delete tickets they created
CREATE POLICY "Users can delete their own tickets" ON public.audit_tickets
FOR DELETE USING (auth.uid() = created_by);

-- Alternative: If you want ALL authenticated users to delete ANY ticket:
-- CREATE POLICY "Authenticated users can delete tickets" ON public.audit_tickets
-- FOR DELETE USING (auth.role() = 'authenticated');

-- Alternative: If you want to allow anyone to delete any ticket (less secure):
-- CREATE POLICY "Users can delete tickets" ON public.audit_tickets
-- FOR DELETE USING (true);

-- Verify the policies
SELECT * FROM pg_policies WHERE tablename = 'audit_tickets';