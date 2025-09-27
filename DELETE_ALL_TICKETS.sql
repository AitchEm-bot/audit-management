-- DELETE ALL TICKETS FROM DATABASE
-- Run this in Supabase Dashboard > SQL Editor

-- First, check how many tickets exist
SELECT COUNT(*) as total_tickets FROM public.audit_tickets;

-- Delete all activities first (if not cascade delete)
DELETE FROM public.ticket_activities;

-- Delete all tickets
DELETE FROM public.audit_tickets;

-- Verify deletion
SELECT COUNT(*) as remaining_tickets FROM public.audit_tickets;
SELECT COUNT(*) as remaining_activities FROM public.ticket_activities;

-- Optional: If you want to reset the auto-increment sequences
-- ALTER SEQUENCE audit_tickets_id_seq RESTART WITH 1;
-- ALTER SEQUENCE ticket_activities_id_seq RESTART WITH 1;