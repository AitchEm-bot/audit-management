import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const department = searchParams.get('department')

  if (!department || department === 'General') {
    return NextResponse.json([])
  }

  const supabase = await createClient()

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, department')
    .eq('department', department)
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  return NextResponse.json(users || [])
}