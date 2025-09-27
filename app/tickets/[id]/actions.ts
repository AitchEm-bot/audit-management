'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addComment(ticketId: string, formData: FormData) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const content = formData.get('content') as string

  if (!content || !content.trim()) {
    redirect(`/tickets/${ticketId}?error=Comment content is required`)
  }

  // Try to insert into ticket_activities table
  const { data: activity, error } = await supabase
    .from('ticket_activities')
    .insert({
      ticket_id: ticketId,
      user_id: user.id,
      activity_type: 'comment',
      content: content.trim(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error inserting activity:', error)
    if (error.code === 'PGRST205' || error.message.includes('table') || error.message.includes('schema cache')) {
      redirect(`/tickets/${ticketId}?error=Database not ready. Please ask admin to run migration.`)
    } else {
      redirect(`/tickets/${ticketId}?error=Could not add comment: ${error.message}`)
    }
  }

  // Handle file uploads if any (for future implementation)
  // const files = formData.getAll('files') as File[]
  // if (files.length > 0 && activity) {
  //   for (const file of files) {
  //     // Upload file logic here
  //   }
  // }

  console.log('Comment added successfully:', activity.id)

  // Revalidate the page to show the new comment
  revalidatePath(`/tickets/${ticketId}`)

  // Force a hard refresh to ensure activities are loaded
  redirect(`/tickets/${ticketId}?success=Comment added successfully&refresh=${Date.now()}`)
}

export async function updateTicketStatus(ticketId: string, newStatus: string) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  try {
    // First get the current status
    const { data: currentTicket } = await supabase
      .from('audit_tickets')
      .select('status')
      .eq('id', ticketId)
      .single()

    // Update the ticket status
    const { error } = await supabase
      .from('audit_tickets')
      .update({ status: newStatus })
      .eq('id', ticketId)

    if (error) {
      console.error('Error updating ticket status:', error)
      return { error: 'Failed to update ticket status' }
    }

    // Try to log the status change activity
    try {
      await supabase.from('ticket_activities').insert({
        ticket_id: ticketId,
        user_id: user.id,
        activity_type: 'status_change',
        content: `Status changed from ${currentTicket?.status} to ${newStatus}`,
        old_value: currentTicket?.status,
        new_value: newStatus,
      })
    } catch (activityError) {
      console.error('Could not log status change activity:', activityError)
      // Continue even if activity logging fails
    }

    console.log('Ticket status updated successfully')

    // Revalidate the page to show the status change
    revalidatePath(`/tickets/${ticketId}`)

    return { success: true }
  } catch (error) {
    console.error('Server error updating status:', error)
    return { error: 'Failed to update ticket status' }
  }
}