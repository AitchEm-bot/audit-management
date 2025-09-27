import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  try {
    console.log('Creating ticket_activities table...');

    // First, let's just test if we can create the basic table manually
    const { data: createResult, error: createError } = await supabase
      .from('ticket_activities')
      .select('id')
      .limit(1);

    if (createError && createError.code === 'PGRST116') {
      console.log('Table does not exist. Need to create it manually via Supabase dashboard.');
      console.log('Please go to Supabase dashboard > SQL Editor and run:');
      console.log(`
CREATE TABLE IF NOT EXISTS public.ticket_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.audit_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  activity_type VARCHAR(50) NOT NULL,
  content TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ticket_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activities" ON public.ticket_activities
FOR SELECT USING (true);

CREATE POLICY "Users can create activities" ON public.ticket_activities
FOR INSERT WITH CHECK (auth.uid() = user_id);
      `);
    } else if (createError) {
      console.error('Unexpected error:', createError);
    } else {
      console.log('Table already exists or is accessible!');

      // Test inserting a comment
      console.log('Testing comment insertion...');
      const { data: testInsert, error: insertError } = await supabase
        .from('ticket_activities')
        .insert({
          ticket_id: '5c5d537d-0eac-43d9-860e-34faadb9b7f1', // Use an existing ticket ID
          user_id: (await supabase.auth.getUser()).data.user?.id,
          activity_type: 'comment',
          content: 'Test comment from migration script'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert test failed:', insertError);
      } else {
        console.log('Test comment inserted successfully:', testInsert);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

createTables();