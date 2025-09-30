'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateTicket(ticketId: string, updates: {
  title: string
  description: string
  department: string
  priority: string
  status: string
  due_date: string | null
  assigned_to: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    // Get current ticket to check status change
    const { data: currentTicket } = await supabase
      .from("audit_tickets")
      .select("status")
      .eq("id", ticketId)
      .single()

    // Check if trying to close - return flag to show dialog
    if (updates.status === "closed" && currentTicket?.status !== "closed") {
      return { requiresCloseDialog: true }
    }

    // Update ticket
    const { error } = await supabase
      .from("audit_tickets")
      .update(updates)
      .eq("id", ticketId)

    if (error) {
      return { error: 'Failed to update ticket' }
    }

    revalidatePath(`/tickets/${ticketId}`)
    return { success: true }
  } catch (error) {
    return { error: 'An unexpected error occurred' }
  }
}

export async function deleteTicket(ticketId: string) {
  console.log('🗑️ deleteTicket server action called with ticketId:', ticketId)

  const supabase = await createClient()

  // Check if user is authenticated
  console.log('🔍 Checking user authentication...')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log('👤 User authenticated:', !!user, user?.id)

  if (!user) {
    console.log('❌ No user found, redirecting to login')
    redirect('/auth/login')
  }

  try {
    console.log('🚀 Attempting to delete ticket from database...')

    // First check if ticket exists
    const { data: existingTicket, error: fetchError } = await supabase
      .from('audit_tickets')
      .select('id, title')
      .eq('id', ticketId)
      .single()

    if (fetchError) {
      console.error('❌ Error fetching ticket before delete:', fetchError)
      redirect(`/tickets/${ticketId}/edit?error=Ticket not found: ${fetchError.message}`)
    }

    console.log('📋 Found ticket to delete:', existingTicket)

    // Check what user context we're operating under
    console.log('👤 Current user context:', user?.id, user?.email)

    // Delete the ticket (activities should cascade delete)
    console.log('🔍 About to execute DELETE query for ticket:', ticketId)

    const { error, data, count } = await supabase
      .from('audit_tickets')
      .delete()
      .eq('id', ticketId)
      .select()

    console.log('🔥 Delete query result:')
    console.log('  - error:', error)
    console.log('  - data:', data)
    console.log('  - count:', count)
    console.log('  - data length:', data?.length)

    if (error) {
      console.error('❌ Error deleting ticket:', error)
      redirect(`/tickets/${ticketId}/edit?error=Failed to delete ticket: ${error.message}`)
    }

    console.log('✅ Ticket deleted successfully:', ticketId)

    // Verify the ticket is actually gone
    console.log('🔍 Verifying ticket was actually deleted...')
    const { data: verifyTicket, error: verifyError } = await supabase
      .from('audit_tickets')
      .select('id')
      .eq('id', ticketId)
      .single()

    if (verifyError && verifyError.code === 'PGRST116') {
      console.log('✅ Verified: Ticket is gone from database')
    } else if (verifyTicket) {
      console.log('❌ WARNING: Ticket still exists in database after delete!', verifyTicket)
    } else {
      console.log('🤔 Verification result unclear:', verifyError)
    }

    // Revalidate the tickets page
    console.log('🔄 Revalidating /tickets path...')
    revalidatePath('/tickets')
    revalidatePath(`/tickets/${ticketId}`)
    revalidatePath(`/tickets/${ticketId}/edit`)

    console.log('↪️ Redirecting to tickets list...')
    // Redirect to tickets list
    redirect('/tickets?success=Ticket deleted successfully')
  } catch (error) {
    // Check if this is a redirect error (which is normal)
    if (error && typeof error === 'object' && 'digest' in error &&
        typeof error.digest === 'string' && error.digest.includes('NEXT_REDIRECT')) {
      console.log('🔄 Redirect error caught (this is normal), re-throwing...')
      throw error
    }

    console.error('💥 Server error deleting ticket:', error)
    redirect(`/tickets/${ticketId}/edit?error=Failed to delete ticket`)
  }
}