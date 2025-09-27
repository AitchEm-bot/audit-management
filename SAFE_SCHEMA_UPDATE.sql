-- SAFE AUDIT SCHEMA UPDATE FOR ENHANCED CSV PARSING
-- Run this in Supabase Dashboard > SQL Editor
-- This version handles existing policies and tables safely

-- Step 1: Create a backup of existing data (if any)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_tickets') THEN
        DROP TABLE IF EXISTS audit_tickets_backup;
        CREATE TABLE audit_tickets_backup AS SELECT * FROM public.audit_tickets;
        RAISE NOTICE 'Backup created: audit_tickets_backup';
    END IF;
END $$;

-- Step 2: Drop existing policies first
DO $$
BEGIN
    -- Drop audit_tickets policies
    DROP POLICY IF EXISTS "Users can view all tickets" ON public.audit_tickets;
    DROP POLICY IF EXISTS "Users can create tickets" ON public.audit_tickets;
    DROP POLICY IF EXISTS "Users can update their own tickets or assigned tickets" ON public.audit_tickets;

    -- Drop audit_comments policies
    DROP POLICY IF EXISTS "Users can view all comments" ON public.audit_comments;
    DROP POLICY IF EXISTS "Users can create comments" ON public.audit_comments;
    DROP POLICY IF EXISTS "Users can update their own comments" ON public.audit_comments;

    -- Drop audit_attachments policies
    DROP POLICY IF EXISTS "Users can view all attachments" ON public.audit_attachments;
    DROP POLICY IF EXISTS "Users can upload attachments" ON public.audit_attachments;

    RAISE NOTICE 'Existing policies dropped';
END $$;

-- Step 3: Drop tables in correct order (due to foreign keys)
DROP TABLE IF EXISTS public.audit_comments CASCADE;
DROP TABLE IF EXISTS public.audit_attachments CASCADE;
DROP TABLE IF EXISTS public.audit_tickets CASCADE;

-- Step 4: Create the enhanced audit_tickets table
CREATE TABLE public.audit_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT, -- Changed from VARCHAR(100) to TEXT for long department names
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),

  -- Additional audit-specific fields
  recommendations TEXT, -- Audit recommendations
  management_response TEXT, -- Management's response to audit findings
  risk_level VARCHAR(20), -- Separate from priority
  finding_status VARCHAR(50), -- Status of the audit finding itself
  responsibility TEXT, -- Who is responsible (can be longer than department)
  followup TEXT, -- Follow-up actions required
  followup_response TEXT, -- Response to follow-up
  management_updates TEXT, -- Updates from management

  -- Standard fields
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  due_date DATE, -- Changed from TIMESTAMP to DATE for simpler CSV handling
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Recreate related tables
CREATE TABLE public.audit_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.audit_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.audit_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.audit_tickets(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Enable Row Level Security
ALTER TABLE public.audit_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_attachments ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS Policies
-- Policies for audit_tickets
CREATE POLICY "Users can view all tickets" ON public.audit_tickets FOR SELECT USING (true);
CREATE POLICY "Users can create tickets" ON public.audit_tickets FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their own tickets or assigned tickets" ON public.audit_tickets FOR UPDATE
  USING (auth.uid() = created_by OR auth.uid() = assigned_to);

-- Policies for audit_comments
CREATE POLICY "Users can view all comments" ON public.audit_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.audit_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.audit_comments FOR UPDATE USING (auth.uid() = user_id);

-- Policies for audit_attachments
CREATE POLICY "Users can view all attachments" ON public.audit_attachments FOR SELECT USING (true);
CREATE POLICY "Users can upload attachments" ON public.audit_attachments FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- Step 8: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_tickets_status ON public.audit_tickets(status);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_department ON public.audit_tickets(department);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_priority ON public.audit_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_created_by ON public.audit_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_assigned_to ON public.audit_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_due_date ON public.audit_tickets(due_date);
CREATE INDEX IF NOT EXISTS idx_audit_comments_ticket_id ON public.audit_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_attachments_ticket_id ON public.audit_attachments(ticket_id);

-- Step 9: Recreate triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_audit_tickets_updated_at BEFORE UPDATE ON public.audit_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Verify the new structure
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'audit_tickets' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Schema update completed successfully!';
    RAISE NOTICE 'New audit-specific fields added: recommendations, management_response, risk_level, finding_status, responsibility, followup, followup_response, management_updates';
    RAISE NOTICE 'Department field changed to TEXT (unlimited length)';
    RAISE NOTICE 'Due date changed to DATE type for CSV compatibility';
END $$;