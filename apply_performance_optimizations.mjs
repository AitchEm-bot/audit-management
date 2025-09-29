#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyOptimizations() {
  console.log('🚀 Starting database performance optimizations...\n')

  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'scripts', '004_performance_indexes.sql')
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8')

    // Split SQL content by semicolons and filter out empty statements
    const statements = sqlContent
      .split(/;(?=\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|ANALYZE|COMMENT|REFRESH))/i)
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim()

      // Skip empty statements or pure comments
      if (!statement || statement.startsWith('--')) {
        continue
      }

      // Extract a short description of the statement
      const firstLine = statement.split('\n')[0]
      const description = firstLine.substring(0, 80) + (firstLine.length > 80 ? '...' : '')

      process.stdout.write(`[${i + 1}/${statements.length}] Executing: ${description}`)

      try {
        // Add semicolon back if missing
        const sqlToExecute = statement.endsWith(';') ? statement : statement + ';'

        const { error } = await supabase.rpc('exec_sql', {
          sql_query: sqlToExecute
        }).single()

        if (error) {
          // Check if error is due to object already existing
          if (error.message?.includes('already exists')) {
            process.stdout.write(' ⏩ Skipped (already exists)\n')
            skipCount++
          } else {
            process.stdout.write(` ❌ Error: ${error.message}\n`)
            errorCount++
            console.error(`Full error details: ${JSON.stringify(error)}`)
          }
        } else {
          process.stdout.write(' ✅ Success\n')
          successCount++
        }
      } catch (err) {
        process.stdout.write(` ❌ Error: ${err.message}\n`)
        errorCount++
      }

      // Add a small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('\n' + '='.repeat(60))
    console.log('📈 Optimization Results:')
    console.log('='.repeat(60))
    console.log(`✅ Successful: ${successCount} statements`)
    console.log(`⏩ Skipped: ${skipCount} statements (already existed)`)
    console.log(`❌ Errors: ${errorCount} statements`)
    console.log('='.repeat(60))

    if (errorCount === 0) {
      console.log('\n🎉 Database performance optimizations completed successfully!')
      console.log('\n📋 Next Steps:')
      console.log('1. Test the application to verify performance improvements')
      console.log('2. Monitor query performance using the get_slow_queries() function')
      console.log('3. Schedule regular refreshes of materialized views (every 15 minutes)')
      console.log('4. Run VACUUM ANALYZE weekly for optimal performance')
    } else {
      console.log('\n⚠️  Some optimizations failed. Please review the errors above.')
      console.log('You may need to run the failed statements manually in Supabase SQL Editor.')
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

// Alternative: Direct SQL execution if RPC doesn't work
async function applyOptimizationsDirect() {
  console.log('🚀 Applying optimizations using direct SQL execution...\n')
  console.log('📝 Please run the following SQL file in your Supabase SQL Editor:')
  console.log('   scripts/004_performance_indexes.sql\n')

  console.log('Steps to apply manually:')
  console.log('1. Go to your Supabase Dashboard')
  console.log('2. Navigate to SQL Editor')
  console.log('3. Copy the contents of scripts/004_performance_indexes.sql')
  console.log('4. Paste and execute in the SQL Editor')
  console.log('5. Monitor the execution for any errors\n')

  console.log('The optimizations include:')
  console.log('• Composite indexes for common query patterns')
  console.log('• Covering indexes for report generation')
  console.log('• Partial indexes for filtered queries')
  console.log('• BRIN indexes for time-series data')
  console.log('• Materialized views for aggregations')
  console.log('• Optimized database functions for statistics\n')
}

// Check if we can use RPC, otherwise provide manual instructions
async function main() {
  console.log('🔍 Checking Supabase connection...')

  try {
    // Test the connection
    const { data, error } = await supabase.from('audit_tickets').select('count', { count: 'exact', head: true })

    if (error) {
      console.log('⚠️  Unable to connect with provided credentials')
      console.log('Error:', error.message)
      applyOptimizationsDirect()
    } else {
      console.log('✅ Connected to Supabase successfully\n')

      // Check if we have exec_sql RPC function
      const { data: functions } = await supabase.rpc('get_dashboard_stats', {})

      if (functions !== null) {
        console.log('ℹ️  Note: exec_sql RPC function not available.')
        console.log('    The optimizations need to be applied manually.\n')
        applyOptimizationsDirect()
      } else {
        await applyOptimizations()
      }
    }
  } catch (err) {
    console.log('⚠️  Connection test failed:', err.message)
    applyOptimizationsDirect()
  }
}

main().catch(console.error)