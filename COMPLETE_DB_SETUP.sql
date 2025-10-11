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
  role VARCHAR(50) DEFAULT 'emp' CHECK (role IN ('emp', 'manager', 'exec', 'admin')),
  status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'active')),
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

  -- Approval workflow fields (Updated for role-based views)
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  resolution_comment TEXT,
  closing_comment TEXT,

  -- Role-based approval fields
  requires_manager_approval BOOLEAN DEFAULT FALSE,
  manager_approved_by UUID REFERENCES auth.users(id),
  manager_approved_at TIMESTAMP WITH TIME ZONE,
  approval_comment TEXT,
  approval_status VARCHAR(20) DEFAULT NULL CHECK (approval_status IN (NULL, 'pending', 'approved', 'rejected')),

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
    'due_date_change',
    'closure_request',
    'approval_response'
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
  FOR INSERT WITH CHECK (
    auth.uid() = id OR
    auth.uid() IS NULL  -- Allow signup trigger to create profiles
  );

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete any profile" ON public.profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- STEP 9: CREATE RLS POLICIES - AUDIT TICKETS (Role-Based)
-- =============================================================================

-- All users can view tickets
CREATE POLICY "Users can view all tickets" ON public.audit_tickets
  FOR SELECT USING (true);

-- All users can create tickets
CREATE POLICY "Users can create tickets" ON public.audit_tickets
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Update policies based on roles
-- Admins and Execs can update any ticket
CREATE POLICY "Admins and execs can update any ticket" ON public.audit_tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'exec')
    )
  );

-- Managers can update tickets in their department
CREATE POLICY "Managers can update tickets in their department" ON public.audit_tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND (
        audit_tickets.department = profiles.department
        OR audit_tickets.department = 'General'
        OR audit_tickets.department IS NULL
      )
    )
  );

-- Employees can update tickets in their department or General department
CREATE POLICY "Employees can update tickets in their department" ON public.audit_tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'emp'
      AND (
        audit_tickets.department = profiles.department
        OR audit_tickets.department = 'General'
      )
    )
  );

-- Delete policies based on roles
-- Admins and Execs can delete any ticket
CREATE POLICY "Admins and execs can delete any ticket" ON public.audit_tickets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'exec')
    )
  );

-- Managers can delete tickets in their department
CREATE POLICY "Managers can delete tickets in their department" ON public.audit_tickets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND (
        audit_tickets.department = profiles.department
        OR audit_tickets.department = 'General'
      )
    )
  );

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
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_status_created ON public.profiles(status, created_at DESC);

-- Audit tickets indexes
CREATE INDEX IF NOT EXISTS idx_audit_tickets_status ON public.audit_tickets(status);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_department ON public.audit_tickets(department);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_priority ON public.audit_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_created_by ON public.audit_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_assigned_to ON public.audit_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_due_date ON public.audit_tickets(due_date);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_created_at ON public.audit_tickets(created_at);

-- Role-based approval indexes
CREATE INDEX IF NOT EXISTS idx_audit_tickets_approval_status
ON public.audit_tickets(approval_status)
WHERE approval_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_tickets_requires_approval
ON public.audit_tickets(requires_manager_approval)
WHERE requires_manager_approval = true;

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
  INSERT INTO public.profiles (id, email, full_name, department, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'department', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'emp'),
    COALESCE(NEW.raw_user_meta_data->>'status', 'pending')
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
-- STEP 14A: ROLE-BASED WORKFLOW FUNCTIONS
-- =============================================================================

-- Function to handle ticket closure requests (for employees)
CREATE OR REPLACE FUNCTION request_ticket_closure(
  p_ticket_id UUID,
  p_closing_comment TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket RECORD;
  v_user_role TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get user role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  -- Get ticket details
  SELECT * INTO v_ticket
  FROM public.audit_tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Ticket not found');
  END IF;

  -- Check if user can close directly (manager, exec, admin) or needs approval (employee)
  IF v_user_role IN ('manager', 'exec', 'admin') THEN
    -- Direct closure
    UPDATE public.audit_tickets
    SET
      status = 'closed',
      closing_comment = p_closing_comment,
      updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Log activity
    INSERT INTO public.ticket_activities (
      ticket_id, user_id, activity_type, content, new_value
    ) VALUES (
      p_ticket_id, v_user_id, 'status_change',
      'Ticket closed by ' || v_user_role, 'closed'
    );

    RETURN jsonb_build_object('success', true, 'message', 'Ticket closed successfully');
  ELSE
    -- Employee needs manager approval
    UPDATE public.audit_tickets
    SET
      requires_manager_approval = true,
      approval_status = 'pending',
      resolution_comment = p_closing_comment,
      updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Log activity as closure_request
    INSERT INTO public.ticket_activities (
      ticket_id, user_id, activity_type, content, metadata
    ) VALUES (
      p_ticket_id, v_user_id, 'closure_request',
      p_closing_comment,
      jsonb_build_object(
        'approval_status', 'pending',
        'requires_manager_approval', true
      )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Closure request submitted for manager approval');
  END IF;
END;
$$;

-- Function for manager approval of ticket closures
CREATE OR REPLACE FUNCTION approve_ticket_closure(
  p_ticket_id UUID,
  p_approved BOOLEAN,
  p_approval_comment TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket RECORD;
  v_user_role TEXT;
  v_user_dept TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get user role and department
  SELECT role, department INTO v_user_role, v_user_dept
  FROM public.profiles
  WHERE id = v_user_id;

  -- Check if user is a manager, exec, or admin
  IF v_user_role NOT IN ('manager', 'exec', 'admin') THEN
    RETURN jsonb_build_object('error', 'Unauthorized - Only managers can approve closures');
  END IF;

  -- Get ticket details
  SELECT * INTO v_ticket
  FROM public.audit_tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Ticket not found');
  END IF;

  -- Check if ticket requires approval
  IF NOT v_ticket.requires_manager_approval THEN
    RETURN jsonb_build_object('error', 'Ticket does not require approval');
  END IF;

  -- For managers, check department match
  IF v_user_role = 'manager' AND
     v_ticket.department != v_user_dept AND
     v_ticket.department != 'General' THEN
    RETURN jsonb_build_object('error', 'Unauthorized - Can only approve tickets in your department');
  END IF;

  IF p_approved THEN
    -- Approve and close ticket
    UPDATE public.audit_tickets
    SET
      status = 'closed',
      approval_status = 'approved',
      manager_approved_by = v_user_id,
      manager_approved_at = NOW(),
      approval_comment = p_approval_comment,
      requires_manager_approval = false,
      updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Log approval response activity
    INSERT INTO public.ticket_activities (
      ticket_id, user_id, activity_type, content, metadata
    ) VALUES (
      p_ticket_id, v_user_id, 'approval_response',
      p_approval_comment,
      jsonb_build_object(
        'approved', true,
        'approval_status', 'approved',
        'action', 'approved'
      )
    );

    -- Log status change activity
    INSERT INTO public.ticket_activities (
      ticket_id, user_id, activity_type, content, old_value, new_value
    ) VALUES (
      p_ticket_id, v_user_id, 'status_change',
      'Ticket closed - closure approved by manager',
      v_ticket.status,
      'closed'
    );

    RETURN jsonb_build_object('success', true, 'message', 'Ticket closure approved');
  ELSE
    -- Reject closure request
    UPDATE public.audit_tickets
    SET
      approval_status = 'rejected',
      manager_approved_by = v_user_id,
      manager_approved_at = NOW(),
      approval_comment = p_approval_comment,
      requires_manager_approval = false,
      updated_at = NOW()
    WHERE id = p_ticket_id;

    -- Log rejection activity
    INSERT INTO public.ticket_activities (
      ticket_id, user_id, activity_type, content, metadata
    ) VALUES (
      p_ticket_id, v_user_id, 'approval_response',
      p_approval_comment,
      jsonb_build_object(
        'approved', false,
        'approval_status', 'rejected',
        'action', 'rejected'
      )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Ticket closure rejected');
  END IF;
END;
$$;

-- Function for department-based ticket assignment
CREATE OR REPLACE FUNCTION assign_ticket_to_user(
  p_ticket_id UUID,
  p_assignee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket RECORD;
  v_user_role TEXT;
  v_user_dept TEXT;
  v_assignee_dept TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get user role and department
  SELECT role, department INTO v_user_role, v_user_dept
  FROM public.profiles
  WHERE id = v_user_id;

  -- Get ticket details
  SELECT * INTO v_ticket
  FROM public.audit_tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Ticket not found');
  END IF;

  -- Get assignee department
  SELECT department INTO v_assignee_dept
  FROM public.profiles
  WHERE id = p_assignee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Assignee not found');
  END IF;

  -- Check permissions
  IF v_user_role = 'emp' THEN
    RETURN jsonb_build_object('error', 'Employees cannot assign tickets');
  END IF;

  -- Managers can only assign to people in their department
  IF v_user_role = 'manager' THEN
    -- Check if manager can manage this ticket
    IF v_ticket.department != v_user_dept AND v_ticket.department != 'General' THEN
      RETURN jsonb_build_object('error', 'Can only assign tickets in your department');
    END IF;

    -- Check if assignee is in manager's department
    IF v_assignee_dept != v_user_dept THEN
      RETURN jsonb_build_object('error', 'Can only assign to users in your department');
    END IF;
  END IF;

  -- Perform assignment
  UPDATE public.audit_tickets
  SET
    assigned_to = p_assignee_id,
    updated_at = NOW()
  WHERE id = p_ticket_id;

  -- Activity logging is handled by existing trigger

  RETURN jsonb_build_object('success', true, 'message', 'Ticket assigned successfully');
END;
$$;

-- Grant execute permissions for role-based functions
GRANT EXECUTE ON FUNCTION request_ticket_closure TO authenticated;
GRANT EXECUTE ON FUNCTION approve_ticket_closure TO authenticated;
GRANT EXECUTE ON FUNCTION assign_ticket_to_user TO authenticated;

-- =============================================================================
-- STEP 14B: CREATE VIEW FOR PENDING APPROVALS
-- =============================================================================

-- View for managers to see pending approval requests
CREATE OR REPLACE VIEW pending_approvals AS
SELECT
  t.id,
  t.ticket_number,
  t.title,
  t.department,
  t.resolution_comment,
  t.created_by,
  t.created_at,
  p.full_name as requester_name,
  p.email as requester_email
FROM public.audit_tickets t
LEFT JOIN public.profiles p ON t.created_by = p.id
WHERE t.requires_manager_approval = true
  AND t.approval_status = 'pending';

-- Grant access to the view
GRANT SELECT ON pending_approvals TO authenticated;

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

-- =============================================================================
-- STEP 17: ENABLE REALTIME FOR AUTO-REFRESH
-- =============================================================================

-- Enable realtime for profiles table (for admin panel auto-refresh)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Already enabled, ignore
  END;
END $$;

-- Enable realtime for audit_tickets table (for tickets page auto-refresh)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_tickets;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Already enabled, ignore
  END;
END $$;

-- =============================================================================
-- STEP 17: CASCADE DELETE AND AUTH FUNCTIONS
-- =============================================================================

-- Ensure CASCADE delete from auth.users to profiles
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Re-add the foreign key with CASCADE delete
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Function to delete from auth.users (cascades to profiles)
DROP FUNCTION IF EXISTS public.delete_user_completely;

CREATE OR REPLACE FUNCTION public.delete_user_completely(
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete from auth.users (will cascade to profiles)
  DELETE FROM auth.users WHERE id = target_user_id;
  RETURN FOUND; -- Returns true if a row was deleted
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_completely TO authenticated;

-- =============================================================================
-- STEP 18: ADMIN OPERATIONS ON AUTH.USERS
-- =============================================================================

-- Function to delete a user from auth.users (which will cascade to profiles)
DROP FUNCTION IF EXISTS public.admin_delete_user;

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_user_id UUID,
  admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_role TEXT;
  result JSONB;
BEGIN
  -- Check if the requesting user is an admin
  SELECT role INTO admin_role
  FROM public.profiles
  WHERE id = admin_user_id;

  IF admin_role != 'admin' THEN
    RETURN jsonb_build_object('error', 'Unauthorized - Admin access required');
  END IF;

  -- Prevent admin from deleting themselves
  IF target_user_id = admin_user_id THEN
    RETURN jsonb_build_object('error', 'Cannot delete your own account');
  END IF;

  -- Delete from auth.users (will cascade to profiles due to foreign key)
  DELETE FROM auth.users WHERE id = target_user_id;

  -- Check if deletion was successful
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'User and profile deleted successfully');
END;
$$;

-- Function to update user metadata in auth.users
DROP FUNCTION IF EXISTS public.admin_update_user_metadata;

CREATE OR REPLACE FUNCTION public.admin_update_user_metadata(
  target_user_id UUID,
  admin_user_id UUID,
  new_full_name TEXT DEFAULT NULL,
  new_department TEXT DEFAULT NULL,
  new_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_role TEXT;
  current_metadata JSONB;
  updated_metadata JSONB;
BEGIN
  -- Check if the requesting user is an admin
  SELECT role INTO admin_role
  FROM public.profiles
  WHERE id = admin_user_id;

  IF admin_role != 'admin' THEN
    RETURN jsonb_build_object('error', 'Unauthorized - Admin access required');
  END IF;

  -- Get current raw_user_meta_data
  SELECT raw_user_meta_data INTO current_metadata
  FROM auth.users
  WHERE id = target_user_id;

  IF current_metadata IS NULL THEN
    current_metadata := '{}'::jsonb;
  END IF;

  -- Build updated metadata
  updated_metadata := current_metadata;

  IF new_full_name IS NOT NULL THEN
    updated_metadata := jsonb_set(updated_metadata, '{full_name}', to_jsonb(new_full_name));
  END IF;

  IF new_department IS NOT NULL THEN
    updated_metadata := jsonb_set(updated_metadata, '{department}', to_jsonb(new_department));
  END IF;

  IF new_role IS NOT NULL THEN
    updated_metadata := jsonb_set(updated_metadata, '{role}', to_jsonb(new_role));
  END IF;

  -- Update auth.users metadata
  UPDATE auth.users
  SET
    raw_user_meta_data = updated_metadata,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Also update the profile table to keep in sync
  UPDATE public.profiles
  SET
    full_name = COALESCE(new_full_name, full_name),
    department = COALESCE(new_department, department),
    role = COALESCE(new_role::varchar(50), role),
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User metadata updated successfully',
    'updated_metadata', updated_metadata
  );
END;
$$;

-- Function to sync profile changes to auth.users metadata
DROP FUNCTION IF EXISTS public.sync_profile_to_auth;

CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update auth.users metadata when profile is updated
  UPDATE auth.users
  SET
    raw_user_meta_data = jsonb_build_object(
      'full_name', NEW.full_name,
      'department', NEW.department,
      'role', NEW.role,
      'status', NEW.status
    ),
    updated_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Create trigger to sync profile updates to auth.users
DROP TRIGGER IF EXISTS sync_profile_to_auth_trigger ON public.profiles;

CREATE TRIGGER sync_profile_to_auth_trigger
AFTER UPDATE OF full_name, department, role, status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_to_auth();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_metadata TO authenticated;

-- =============================================================================
-- STEP 19: EMAIL VERIFICATION FUNCTIONS
-- =============================================================================

-- Function to check email verification status
DROP FUNCTION IF EXISTS public.check_email_verification_status;

CREATE OR REPLACE FUNCTION public.check_email_verification_status(user_email TEXT)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  email_confirmed_at TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    u.email::TEXT as email,
    u.email_confirmed_at,
    CASE
      WHEN u.email_confirmed_at IS NOT NULL THEN true
      ELSE false
    END as is_verified
  FROM auth.users u
  WHERE LOWER(u.email) = LOWER(user_email)
  LIMIT 1;
END;
$$;

-- Function that returns both profile and auth status
DROP FUNCTION IF EXISTS public.get_profile_with_auth_status;

CREATE OR REPLACE FUNCTION public.get_profile_with_auth_status(user_email TEXT)
RETURNS TABLE(
  id UUID,
  email TEXT,
  full_name TEXT,
  department VARCHAR(100),
  role VARCHAR(50),
  status VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  email_confirmed_at TIMESTAMP WITH TIME ZONE,
  email_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email::TEXT,
    p.full_name::TEXT,
    p.department,
    p.role,
    p.status,
    p.created_at,
    p.updated_at,
    u.email_confirmed_at,
    CASE
      WHEN u.email_confirmed_at IS NOT NULL THEN true
      ELSE false
    END as email_verified
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  WHERE LOWER(p.email) = LOWER(user_email)
  LIMIT 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_email_verification_status TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_verification_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_verification_status TO service_role;
GRANT EXECUTE ON FUNCTION public.get_profile_with_auth_status TO anon;
GRANT EXECUTE ON FUNCTION public.get_profile_with_auth_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_with_auth_status TO service_role;

-- =============================================================================
-- STEP 20: PROFILES VIEW WITH AUTH STATUS
-- =============================================================================

-- Drop the view if it exists first
DROP VIEW IF EXISTS public.profiles_with_auth CASCADE;

-- Create a view that joins profiles with auth.users to get email confirmation status
CREATE VIEW public.profiles_with_auth AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.department,
  p.role,
  p.status,
  p.created_at,
  p.updated_at,
  u.email_confirmed_at,
  CASE
    WHEN u.email_confirmed_at IS NOT NULL THEN true
    ELSE false
  END as email_verified
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id;

-- Grant access to all users
GRANT SELECT ON public.profiles_with_auth TO authenticated;
GRANT SELECT ON public.profiles_with_auth TO anon;
GRANT SELECT ON public.profiles_with_auth TO service_role;

-- Set view owner
ALTER VIEW public.profiles_with_auth OWNER TO postgres;

-- =============================================================================
-- STEP 21: REJECTION TRACKING
-- =============================================================================

-- Create a table to track rejected user registrations
CREATE TABLE IF NOT EXISTS public.rejected_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  rejected_by UUID REFERENCES auth.users(id),
  reason TEXT
);

-- Create index for email lookups
CREATE INDEX idx_rejected_registrations_email ON public.rejected_registrations(email);

-- Function to check if an email was rejected
DROP FUNCTION IF EXISTS public.check_rejection_status;

CREATE OR REPLACE FUNCTION public.check_rejection_status(user_email TEXT)
RETURNS TABLE(
  is_rejected BOOLEAN,
  rejected_at TIMESTAMP WITH TIME ZONE,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    true as is_rejected,
    rr.rejected_at,
    rr.reason
  FROM public.rejected_registrations rr
  WHERE LOWER(rr.email) = LOWER(user_email)
  ORDER BY rr.rejected_at DESC
  LIMIT 1;

  -- If no rejection found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false::boolean as is_rejected, NULL::timestamp with time zone as rejected_at, NULL::text as reason;
  END IF;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.rejected_registrations TO anon;
GRANT SELECT ON public.rejected_registrations TO authenticated;
GRANT INSERT ON public.rejected_registrations TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rejection_status TO anon;
GRANT EXECUTE ON FUNCTION public.check_rejection_status TO authenticated;

-- RLS policies
ALTER TABLE public.rejected_registrations ENABLE ROW LEVEL SECURITY;

-- Allow admins to insert rejection records
CREATE POLICY "Admins can insert rejection records" ON public.rejected_registrations
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Allow anyone to read rejection records (for checking status)
CREATE POLICY "Anyone can check rejection status" ON public.rejected_registrations
FOR SELECT TO anon, authenticated
USING (true);

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Database setup completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - profiles (with status field for admin approval workflow)';
    RAISE NOTICE '  - audit_tickets';
    RAISE NOTICE '  - ticket_activities';
    RAISE NOTICE '  - ticket_comment_attachments';
    RAISE NOTICE '  - audit_logs';
    RAISE NOTICE '  - rejected_registrations (tracks rejected users)';
    RAISE NOTICE '';
    RAISE NOTICE 'User registration workflow:';
    RAISE NOTICE '  - New users start with status: pending';
    RAISE NOTICE '  - Email verification tracked via auth.users join';
    RAISE NOTICE '  - Admins can approve users (status: active)';
    RAISE NOTICE '  - Admins can reject/delete users (removes from auth.users + profiles)';
    RAISE NOTICE '  - Admin RLS policies configured for user management';
    RAISE NOTICE '  - Profile updates sync to auth.users metadata';
    RAISE NOTICE '';
    RAISE NOTICE 'Realtime subscriptions enabled:';
    RAISE NOTICE '  - profiles table: Auto-refresh admin panel';
    RAISE NOTICE '  - audit_tickets table: Auto-refresh tickets page';
    RAISE NOTICE '  - Sign-up success page auto-detects approval';
    RAISE NOTICE '';
    RAISE NOTICE 'Created storage:';
    RAISE NOTICE '  - ticket-attachments bucket (50MB file limit)';
    RAISE NOTICE '  - Storage RLS policies for upload/view/delete';
    RAISE NOTICE '';
    RAISE NOTICE 'Created materialized views:';
    RAISE NOTICE '  - mv_department_stats';
    RAISE NOTICE '  - mv_daily_metrics';
    RAISE NOTICE '';
    RAISE NOTICE 'Created functions for auth management:';
    RAISE NOTICE '  - admin_delete_user: Delete users from auth.users + profiles';
    RAISE NOTICE '  - admin_update_user_metadata: Sync profile changes to auth.users';
    RAISE NOTICE '  - get_profile_with_auth_status: Check email verification status';
    RAISE NOTICE '  - delete_user_completely: Simple user deletion with CASCADE';
    RAISE NOTICE '';
    RAISE NOTICE 'Created role-based workflow functions:';
    RAISE NOTICE '  - request_ticket_closure: Employee closure requests with manager approval';
    RAISE NOTICE '  - approve_ticket_closure: Manager approval/rejection of closures';
    RAISE NOTICE '  - assign_ticket_to_user: Department-based ticket assignment';
    RAISE NOTICE '';
    RAISE NOTICE 'Created views:';
    RAISE NOTICE '  - profiles_with_auth: Joins profiles with auth.users for email verification';
    RAISE NOTICE '  - pending_approvals: Manager view for pending closure approvals';
    RAISE NOTICE '';
    RAISE NOTICE 'All RLS policies, triggers, and indexes have been created.';
    RAISE NOTICE '';
    RAISE NOTICE 'Role-based access control:';
    RAISE NOTICE '  - Admins & Executives: Full access to all tickets';
    RAISE NOTICE '  - Managers: Department-specific access + General tickets';
    RAISE NOTICE '  - Employees: Limited to own tickets + department view';
    RAISE NOTICE '  - Approval workflow for employee ticket closures';
    RAISE NOTICE '';
    RAISE NOTICE 'Supported file types:';
    RAISE NOTICE '  - Images: JPEG, PNG, GIF, WebP, SVG';
    RAISE NOTICE '  - Videos: MP4, WebM, MOV, AVI';
    RAISE NOTICE '  - Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV';
END $$;
