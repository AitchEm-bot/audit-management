-- COMPLETE DATABASE SETUP FOR AUDIT MANAGEMENT SYSTEM
-- Run this in Supabase Dashboard > SQL Editor
-- This creates all tables, triggers, functions, and views needed for the application

-- =============================================================================
-- STEP 1: DROP EXISTING TABLES (Clean slate)
-- =============================================================================

DROP TABLE IF EXISTS public.ticket_comment_attachments CASCADE;
DROP TABLE IF EXISTS public.ticket_activities CASCADE;
DROP TABLE IF EXISTS public.audit_comments CASCADE;
DROP TABLE IF EXISTS public.audit_attachments CASCADE;
DROP TABLE IF EXISTS public.audit_tickets CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP MATERIALIZED VIEW IF EXISTS public.mv_department_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_daily_metrics CASCADE;

-- =============================================================================
-- STEP 2: CREATE PROFILES TABLE
-- =============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  department VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 3: CREATE AUDIT TICKETS TABLE
-- =============================================================================

CREATE TABLE public.audit_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),

  -- Additional audit-specific fields
  recommendations TEXT,
  management_response TEXT,
  risk_level VARCHAR(20),
  finding_status VARCHAR(50),
  responsibility TEXT,
  followup TEXT,
  followup_response TEXT,
  management_updates TEXT,

  -- Approval workflow fields
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  resolution_comment TEXT,
  closing_comment TEXT,

  -- Standard fields
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 4: CREATE TICKET ACTIVITIES TABLE (Timeline/Comments)
-- =============================================================================

CREATE TABLE public.ticket_activities (
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

-- =============================================================================
-- STEP 5: CREATE TICKET COMMENT ATTACHMENTS TABLE
-- =============================================================================

CREATE TABLE public.ticket_comment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES public.ticket_activities(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 6: CREATE AUDIT LOGS TABLE
-- =============================================================================

CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 8: CREATE RLS POLICIES - PROFILES
-- =============================================================================

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- STEP 9: CREATE RLS POLICIES - AUDIT TICKETS
-- =============================================================================

CREATE POLICY "Users can view all tickets" ON public.audit_tickets
  FOR SELECT USING (true);

CREATE POLICY "Users can create tickets" ON public.audit_tickets
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own tickets or assigned tickets" ON public.audit_tickets
  FOR UPDATE USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE POLICY "Users can delete their own tickets" ON public.audit_tickets
  FOR DELETE USING (auth.uid() = created_by);

-- =============================================================================
-- STEP 10: CREATE RLS POLICIES - TICKET ACTIVITIES
-- =============================================================================

CREATE POLICY "Users can view activities for accessible tickets" ON public.ticket_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.audit_tickets t
      WHERE t.id = ticket_activities.ticket_id
    )
  );

CREATE POLICY "Users can create activities" ON public.ticket_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities" ON public.ticket_activities
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities" ON public.ticket_activities
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- STEP 11: CREATE RLS POLICIES - TICKET COMMENT ATTACHMENTS
-- =============================================================================

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

CREATE POLICY "Users can delete their own comment attachments" ON public.ticket_comment_attachments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.ticket_activities ta
      WHERE ta.id = ticket_comment_attachments.activity_id
      AND ta.user_id = auth.uid()
    )
  );

-- =============================================================================
-- STEP 12: CREATE RLS POLICIES - AUDIT LOGS
-- =============================================================================

CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- STEP 13: CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department);

-- Audit tickets indexes
CREATE INDEX IF NOT EXISTS idx_audit_tickets_status ON public.audit_tickets(status);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_department ON public.audit_tickets(department);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_priority ON public.audit_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_created_by ON public.audit_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_assigned_to ON public.audit_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_due_date ON public.audit_tickets(due_date);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_created_at ON public.audit_tickets(created_at);

-- Ticket activities indexes
CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket_id ON public.ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_created_at ON public.ticket_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_type ON public.ticket_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_user_id ON public.ticket_activities(user_id);

-- Comment attachments indexes
CREATE INDEX IF NOT EXISTS idx_comment_attachments_activity_id ON public.ticket_comment_attachments(activity_id);
CREATE INDEX IF NOT EXISTS idx_comment_attachments_created_at ON public.ticket_comment_attachments(created_at DESC);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- =============================================================================
-- STEP 14: CREATE FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_audit_tickets_updated_at
  BEFORE UPDATE ON public.audit_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'department', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

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

DROP TRIGGER IF EXISTS trigger_ticket_created_activity ON public.audit_tickets;
CREATE TRIGGER trigger_ticket_created_activity
    AFTER INSERT ON public.audit_tickets
    FOR EACH ROW EXECUTE FUNCTION create_ticket_created_activity();

-- Function to automatically track status, priority, and assignment changes
CREATE OR REPLACE FUNCTION track_ticket_status_change()
RETURNS TRIGGER AS $$
DECLARE
    old_user_name TEXT;
    new_user_name TEXT;
    old_user_email TEXT;
    new_user_email TEXT;
BEGIN
    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
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

    -- Track priority changes
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
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
            'priority_change',
            'Priority changed from ' || OLD.priority || ' to ' || NEW.priority,
            OLD.priority,
            NEW.priority
        );
    END IF;

    -- Track assignment changes with user names in metadata
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        -- Get old user info if exists
        IF OLD.assigned_to IS NOT NULL THEN
            SELECT full_name, email INTO old_user_name, old_user_email
            FROM public.profiles
            WHERE id = OLD.assigned_to;

            -- Fallback to email from auth.users if profile doesn't exist
            IF old_user_name IS NULL THEN
                SELECT email INTO old_user_email
                FROM auth.users
                WHERE id = OLD.assigned_to;
                old_user_name := COALESCE(old_user_email, 'Unknown User');
            END IF;
        END IF;

        -- Get new user info if exists
        IF NEW.assigned_to IS NOT NULL THEN
            SELECT full_name, email INTO new_user_name, new_user_email
            FROM public.profiles
            WHERE id = NEW.assigned_to;

            -- Fallback to email from auth.users if profile doesn't exist
            IF new_user_name IS NULL THEN
                SELECT email INTO new_user_email
                FROM auth.users
                WHERE id = NEW.assigned_to;
                new_user_name := COALESCE(new_user_email, 'Unknown User');
            END IF;
        END IF;

        INSERT INTO public.ticket_activities (
            ticket_id,
            user_id,
            activity_type,
            content,
            old_value,
            new_value,
            metadata
        ) VALUES (
            NEW.id,
            auth.uid(),
            'assignment_change',
            CASE
                WHEN NEW.assigned_to IS NULL THEN 'Ticket unassigned'
                WHEN OLD.assigned_to IS NULL THEN 'Ticket assigned to ' || COALESCE(new_user_name, NEW.assigned_to::text)
                ELSE 'Assignment changed from ' || COALESCE(old_user_name, OLD.assigned_to::text) || ' to ' || COALESCE(new_user_name, NEW.assigned_to::text)
            END,
            OLD.assigned_to::text,
            NEW.assigned_to::text,
            jsonb_build_object(
                'old_user_name', old_user_name,
                'new_user_name', new_user_name,
                'old_user_email', old_user_email,
                'new_user_email', new_user_email
            )
        );
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_track_ticket_changes ON public.audit_tickets;
CREATE TRIGGER trigger_track_ticket_changes
    AFTER UPDATE ON public.audit_tickets
    FOR EACH ROW EXECUTE FUNCTION track_ticket_status_change();

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_action VARCHAR(100),
    p_resource_type VARCHAR(50),
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        details
    ) VALUES (
        auth.uid(),
        p_action,
        p_resource_type,
        p_resource_id,
        p_details
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 15: CREATE TRIGGERS FOR ATTACHMENT ACTIVITY LOGGING
-- =============================================================================

-- Function to log attachment addition
-- Only creates standalone activity if parent comment has no content (file-only comment)
CREATE OR REPLACE FUNCTION log_attachment_added()
RETURNS TRIGGER AS $$
DECLARE
  ticket_id_var UUID;
  comment_content TEXT;
BEGIN
  -- Get the ticket_id and comment content from the activity
  SELECT ticket_id, content INTO ticket_id_var, comment_content
  FROM public.ticket_activities
  WHERE id = NEW.activity_id;

  -- Only create standalone activity if the comment is empty (file-only comment)
  -- If comment has text, the attachment will be displayed inline with the comment
  IF comment_content IS NULL OR TRIM(comment_content) = '' THEN
    INSERT INTO public.ticket_activities (
      ticket_id,
      user_id,
      activity_type,
      content,
      metadata
    ) VALUES (
      ticket_id_var,
      auth.uid(),
      'file_attachment',
      'Attached file: ' || NEW.filename,
      jsonb_build_object(
        'attachment_id', NEW.id,
        'filename', NEW.filename,
        'file_size', NEW.file_size,
        'mime_type', NEW.mime_type,
        'action', 'added'
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_attachment_added ON public.ticket_comment_attachments;
CREATE TRIGGER trigger_log_attachment_added
  AFTER INSERT ON public.ticket_comment_attachments
  FOR EACH ROW
  EXECUTE FUNCTION log_attachment_added();

-- Function to log attachment deletion
-- Silent deletion - no activity log created, just removes from comment
CREATE OR REPLACE FUNCTION log_attachment_deleted()
RETURNS TRIGGER AS $$
BEGIN
  -- Silent deletion - attachment is just removed from the comment
  -- No standalone activity log is created
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_attachment_deleted ON public.ticket_comment_attachments;
CREATE TRIGGER trigger_log_attachment_deleted
  BEFORE DELETE ON public.ticket_comment_attachments
  FOR EACH ROW
  EXECUTE FUNCTION log_attachment_deleted();

-- =============================================================================
-- STEP 15A: CREATE STORAGE BUCKET FOR ATTACHMENTS
-- =============================================================================

-- Create the ticket-attachments bucket (50MB limit to stay within Supabase free tier)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false,
  52428800, -- 50MB in bytes (limit set to work within Supabase global storage limits)
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/avi',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/avi',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ];

-- =============================================================================
-- STEP 15B: CREATE STORAGE POLICIES
-- =============================================================================

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view attachments
DROP POLICY IF EXISTS "Users can view attachments" ON storage.objects;
CREATE POLICY "Users can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ticket-attachments');

-- Allow users to delete their own attachments
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- =============================================================================
-- STEP 15C: ADD RLS POLICY FOR DELETING ATTACHMENTS
-- =============================================================================

DROP POLICY IF EXISTS "Users can delete their own comment attachments" ON public.ticket_comment_attachments;
CREATE POLICY "Users can delete their own comment attachments"
ON public.ticket_comment_attachments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.ticket_activities ta
    WHERE ta.id = ticket_comment_attachments.activity_id
    AND ta.user_id = auth.uid()
  )
);

-- =============================================================================
-- STEP 15D: ADD INDEX FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_comment_attachments_created_at
ON public.ticket_comment_attachments(created_at DESC);

-- =============================================================================
-- STEP 16: CREATE MATERIALIZED VIEWS FOR ANALYTICS
-- =============================================================================

-- Department statistics view
CREATE MATERIALIZED VIEW public.mv_department_stats AS
SELECT
  department,
  COUNT(*) as total_tickets,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tickets,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
  COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_tickets,
  COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_tickets
FROM public.audit_tickets
WHERE department IS NOT NULL
GROUP BY department;

CREATE UNIQUE INDEX ON public.mv_department_stats (department);

-- Daily metrics view
CREATE MATERIALIZED VIEW public.mv_daily_metrics AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as tickets_created,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as tickets_closed,
  COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_tickets,
  COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_tickets
FROM public.audit_tickets
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

CREATE UNIQUE INDEX ON public.mv_daily_metrics (date);

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Database setup completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - profiles';
    RAISE NOTICE '  - audit_tickets';
    RAISE NOTICE '  - ticket_activities';
    RAISE NOTICE '  - ticket_comment_attachments';
    RAISE NOTICE '  - audit_logs';
    RAISE NOTICE '';
    RAISE NOTICE 'Created storage:';
    RAISE NOTICE '  - ticket-attachments bucket (50MB file limit)';
    RAISE NOTICE '  - Storage RLS policies for upload/view/delete';
    RAISE NOTICE '';
    RAISE NOTICE 'Created materialized views:';
    RAISE NOTICE '  - mv_department_stats';
    RAISE NOTICE '  - mv_daily_metrics';
    RAISE NOTICE '';
    RAISE NOTICE 'All RLS policies, triggers, and indexes have been created.';
    RAISE NOTICE '';
    RAISE NOTICE 'Supported file types:';
    RAISE NOTICE '  - Images: JPEG, PNG, GIF, WebP, SVG';
    RAISE NOTICE '  - Videos: MP4, WebM, MOV, AVI';
    RAISE NOTICE '  - Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV';
END $$;
