// Quick test to see if the query works
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testQuery() {
  console.log('Testing query...')
  
  const { data, error } = await supabase
    .from("ticket_activities")
    .select("id")
    .eq("ticket_id", "ab867bcd-29f5-437e-a36e-8318d83c4e00")
    .eq("activity_type", "comment")
  
  console.log('Result:', { count: data?.length, error })
}

testQuery()
