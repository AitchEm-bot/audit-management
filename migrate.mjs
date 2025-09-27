import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const sql = readFileSync('./scripts/003_create_ticket_activities.sql', 'utf8');
    console.log('Reading migration file...');

    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      console.log(`Executing statement ${i + 1}/${statements.length}...`);

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });

        if (error) {
          console.error(`Error in statement ${i + 1}:`, error);
          console.error('Statement:', statement);
        } else {
          console.log(`Statement ${i + 1} completed successfully`);
        }
      } catch (err) {
        console.error(`Exception in statement ${i + 1}:`, err);
        console.error('Statement:', statement);
      }
    }

    console.log('Migration process completed!');

  } catch (err) {
    console.error('Error reading migration file:', err);
  }
}

runMigration();