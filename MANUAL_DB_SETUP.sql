-- MANUAL DATABASE SETUP FOR TICKET ACTIVITIES
-- Copy and paste this SQL in your Supabase Dashboard > SQL Editor

-- 1. Create the ticket_activities table
CREATE TABLE IF NOT EXISTS public.ticket_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.audit_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'ticket_created',
    'status_change',
    'assignment_change',
    'comment',
    'file_attachment',
    'priority_change',
    'due_date_change'
  )),
  content TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.ticket_activities ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
CREATE POLICY "Users can view activities" ON public.ticket_activities
FOR SELECT USING (true);

CREATE POLICY "Users can create activities" ON public.ticket_activities
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket_id ON public.ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_created_at ON public.ticket_activities(created_at);

-- 5. Test the setup by inserting a sample comment (optional)
-- Replace 'YOUR_TICKET_ID' with an actual ticket ID from your audit_tickets table
-- INSERT INTO public.ticket_activities (
--   ticket_id,
--   user_id,
--   activity_type,
--   content
-- ) VALUES (
--   'YOUR_TICKET_ID',
--   auth.uid(),
--   'comment',
--   'Test comment - database setup working!'
-- );

-- After running this, the comment system should work!