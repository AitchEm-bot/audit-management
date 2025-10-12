-- Migration: Change status constraint from 'resolved' to 'pending'
-- This updates the database to use 'pending' instead of 'resolved' as a ticket status
-- Run this in Supabase Dashboard > SQL Editor

-- Step 1: Drop the old check constraint
ALTER TABLE public.audit_tickets
DROP CONSTRAINT IF EXISTS audit_tickets_status_check;

-- Step 2: Add the new check constraint with 'pending' instead of 'resolved'
ALTER TABLE public.audit_tickets
ADD CONSTRAINT audit_tickets_status_check
CHECK (status IN ('open', 'in_progress', 'pending', 'closed'));

-- Step 3: Update any existing tickets with status 'resolved' to 'pending'
UPDATE public.audit_tickets
SET status = 'pending'
WHERE status = 'resolved';

-- Step 4: Update the materialized view for department stats
DROP MATERIALIZED VIEW IF EXISTS public.mv_department_stats CASCADE;

CREATE MATERIALIZED VIEW public.mv_department_stats AS
SELECT
  department,
  COUNT(*) as total_tickets,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tickets,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tickets,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
  COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_tickets,
  COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_tickets
FROM public.audit_tickets
WHERE department IS NOT NULL
GROUP BY department;

CREATE UNIQUE INDEX ON public.mv_department_stats (department);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'Status constraint updated: resolved → pending';
    RAISE NOTICE 'Materialized views refreshed';
END $$;
