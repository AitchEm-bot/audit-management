-- Add closing_comment field to audit_tickets table
-- This field stores the final closing statement when a ticket is marked as closed
-- Used in audit reports instead of showing all individual comments

ALTER TABLE public.audit_tickets
ADD COLUMN IF NOT EXISTS closing_comment TEXT;

-- Add comment to document the field
COMMENT ON COLUMN public.audit_tickets.closing_comment IS 'Final closing statement summarizing the ticket resolution. Used in audit reports.';