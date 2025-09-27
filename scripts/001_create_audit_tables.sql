-- Create audit tickets table
CREATE TABLE IF NOT EXISTS public.audit_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  department VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit comments table
CREATE TABLE IF NOT EXISTS public.audit_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.audit_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit attachments table
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

-- Create profiles table for user management
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  department VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.audit_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_tickets_status ON public.audit_tickets(status);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_department ON public.audit_tickets(department);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_created_by ON public.audit_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_tickets_assigned_to ON public.audit_tickets(assigned_to);
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

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
