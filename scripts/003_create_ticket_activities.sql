-- Create ticket activities table for timeline tracking
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
  content TEXT, -- For comments or descriptions
  old_value TEXT, -- For tracking changes (old status, old assignee, etc.)
  new_value TEXT, -- For tracking changes (new status, new assignee, etc.)
  metadata JSONB, -- For additional data like file info
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create enhanced ticket attachments table for comment files
CREATE TABLE IF NOT EXISTS public.ticket_comment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES public.ticket_activities(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add approval workflow fields to audit_tickets
ALTER TABLE public.audit_tickets
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolution_comment TEXT;

-- Update profiles table to include department
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- Enable Row Level Security
ALTER TABLE public.ticket_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comment_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticket_activities
CREATE POLICY "Users can view activities for accessible tickets" ON public.ticket_activities
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.audit_tickets t
    WHERE t.id = ticket_activities.ticket_id
  )
);

CREATE POLICY "Users can create activities" ON public.ticket_activities
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for ticket_comment_attachments
CREATE POLICY "Users can view comment attachments" ON public.ticket_comment_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.ticket_activities ta
    WHERE ta.id = ticket_comment_attachments.activity_id
  )
);

CREATE POLICY "Users can upload comment attachments" ON public.ticket_comment_attachments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ticket_activities ta
    WHERE ta.id = ticket_comment_attachments.activity_id
    AND ta.user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket_id ON public.ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_created_at ON public.ticket_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_type ON public.ticket_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_comment_attachments_activity_id ON public.ticket_comment_attachments(activity_id);

-- Function to automatically create ticket_created activity
CREATE OR REPLACE FUNCTION create_ticket_created_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.ticket_activities (
        ticket_id,
        user_id,
        activity_type,
        content,
        new_value
    ) VALUES (
        NEW.id,
        NEW.created_by,
        'ticket_created',
        'Ticket created',
        NEW.status
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically create activity when ticket is created
DROP TRIGGER IF EXISTS trigger_ticket_created_activity ON public.audit_tickets;
CREATE TRIGGER trigger_ticket_created_activity
    AFTER INSERT ON public.audit_tickets
    FOR EACH ROW EXECUTE FUNCTION create_ticket_created_activity();

-- Function to automatically track status changes
CREATE OR REPLACE FUNCTION track_ticket_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track if status actually changed
    IF OLD.status != NEW.status THEN
        INSERT INTO public.ticket_activities (
            ticket_id,
            user_id,
            activity_type,
            content,
            old_value,
            new_value
        ) VALUES (
            NEW.id,
            auth.uid(),
            'status_change',
            'Status changed from ' || OLD.status || ' to ' || NEW.status,
            OLD.status,
            NEW.status
        );
    END IF;

    -- Track assignment changes
    IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
        INSERT INTO public.ticket_activities (
            ticket_id,
            user_id,
            activity_type,
            content,
            old_value,
            new_value
        ) VALUES (
            NEW.id,
            auth.uid(),
            'assignment_change',
            CASE
                WHEN NEW.assigned_to IS NULL THEN 'Ticket unassigned'
                WHEN OLD.assigned_to IS NULL THEN 'Ticket assigned'
                ELSE 'Assignment changed'
            END,
            OLD.assigned_to::text,
            NEW.assigned_to::text
        );
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to track status and assignment changes
DROP TRIGGER IF EXISTS trigger_track_ticket_changes ON public.audit_tickets;
CREATE TRIGGER trigger_track_ticket_changes
    AFTER UPDATE ON public.audit_tickets
    FOR EACH ROW EXECUTE FUNCTION track_ticket_status_change();