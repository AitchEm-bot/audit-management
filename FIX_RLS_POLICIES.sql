-- FIX RLS POLICIES FOR TICKET ACTIVITIES
-- Run this in Supabase Dashboard > SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view activities" ON public.ticket_activities;
DROP POLICY IF EXISTS "Users can create activities" ON public.ticket_activities;

-- Create more permissive policies that work with both authenticated and service role
CREATE POLICY "Enable read access for all users" ON public.ticket_activities
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.ticket_activities
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Alternative: If the above doesn't work, you can temporarily disable RLS for testing
-- ALTER TABLE public.ticket_activities DISABLE ROW LEVEL SECURITY;