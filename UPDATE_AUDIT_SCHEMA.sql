-- UPDATE AUDIT SCHEMA FOR ENHANCED CSV PARSING
-- Run this in Supabase Dashboard > SQL Editor

-- First, backup existing data if any exists
-- CREATE TABLE audit_tickets_backup AS SELECT * FROM public.audit_tickets;

-- Drop existing table to recreate with proper structure
-- Note: This will delete existing data - only run if acceptable
DROP TABLE IF EXISTS public.audit_tickets CASCADE;

-- Create enhanced audit tickets table with proper field lengths and audit-specific columns
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

-- Recreate the comments table (references audit_tickets)
CREATE TABLE IF NOT EXISTS public.audit_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.audit_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate the attachments table (references audit_tickets)
CREATE TABLE IF NOT EXISTS public.audit_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.audit_tickets(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.audit_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_tickets
CREATE POLICY "Users can view all tickets" ON public.audit_tickets FOR SELECT USING (true);
CREATE POLICY "Users can create tickets" ON public.audit_tickets FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their own tickets or assigned tickets" ON public.audit_tickets FOR UPDATE
  USING (auth.uid() = created_by OR auth.uid() = assigned_to);

-- RLS Policies for audit_comments
CREATE POLICY "Users can view all comments" ON public.audit_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.audit_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.audit_comments FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for audit_attachments
CREATE POLICY "Users can view all attachments" ON public.audit_attachments FOR SELECT USING (true);
CREATE POLICY "Users can upload attachments" ON public.audit_attachments FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_tickets_status ON public.audit_tickets(status);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_department ON public.audit_tickets(department);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_priority ON public.audit_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_created_by ON public.audit_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_assigned_to ON public.audit_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_due_date ON public.audit_tickets(due_date);
CREATE INDEX IF NOT EXISTS idx_audit_comments_ticket_id ON public.audit_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_attachments_ticket_id ON public.audit_attachments(ticket_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_audit_tickets_updated_at BEFORE UPDATE ON public.audit_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify the new structure
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_tickets'
ORDER BY ordinal_position;