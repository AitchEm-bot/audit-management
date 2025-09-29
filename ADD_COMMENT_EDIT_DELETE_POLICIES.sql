-- ADD EDIT/DELETE POLICIES FOR COMMENTS
-- Run this in your Supabase Dashboard > SQL Editor

-- Add UPDATE policy: Users can only update their own comments
CREATE POLICY "Users can update their own comments" ON public.ticket_activities
FOR UPDATE USING (
  auth.uid() = user_id
  AND activity_type = 'comment'
) WITH CHECK (
  auth.uid() = user_id
  AND activity_type = 'comment'
);

-- Add DELETE policy: Users can only delete their own comments
CREATE POLICY "Users can delete their own comments" ON public.ticket_activities
FOR DELETE USING (
  auth.uid() = user_id
  AND activity_type = 'comment'
);

-- Verify policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'ticket_activities'
ORDER BY policyname;