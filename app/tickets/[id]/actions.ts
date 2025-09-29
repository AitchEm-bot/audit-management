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

  // Automatically change status from 'open' to 'in_progress' when user comments
  try {
    const { data: currentTicket } = await supabase
      .from('audit_tickets')
      .select('status')
      .eq('id', ticketId)
      .single()

    if (currentTicket?.status === 'open') {
      const { error: statusError } = await supabase
        .from('audit_tickets')
        .update({ status: 'in_progress' })
        .eq('id', ticketId)

      if (statusError) {
        console.error('Error auto-updating status:', statusError)
      } else {
        console.log('Status automatically changed from open to in_progress')
      }
    }
  } catch (statusError) {
    console.error('Error checking/updating ticket status:', statusError)
    // Continue even if status update fails - comment was still added successfully
  }

  // Revalidate the page to show the new comment
  revalidatePath(`/tickets/${ticketId}`)

  // Force a hard refresh to ensure activities are loaded
  redirect(`/tickets/${ticketId}?success=Comment added successfully&refresh=${Date.now()}`)
}

export async function updateComment(activityId: string, newContent: string) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  if (!newContent || !newContent.trim()) {
    return { error: 'Comment content is required' }
  }

  try {
    // Update the comment - RLS policy will ensure user owns the comment
    const { data, error } = await supabase
      .from('ticket_activities')
      .update({ content: newContent.trim() })
      .eq('id', activityId)
      .eq('user_id', user.id) // Extra safety check
      .eq('activity_type', 'comment')
      .select('ticket_id')
      .single()

    if (error) {
      console.error('Error updating comment:', error)
      return { error: 'Failed to update comment. You can only edit your own comments.' }
    }

    console.log('Comment updated successfully')

    // Revalidate the ticket page
    if (data?.ticket_id) {
      revalidatePath(`/tickets/${data.ticket_id}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Server error updating comment:', error)
    return { error: 'Failed to update comment' }
  }
}

export async function deleteComment(activityId: string, ticketId: string) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    // Delete the comment - RLS policy will ensure user owns the comment
    const { error } = await supabase
      .from('ticket_activities')
      .delete()
      .eq('id', activityId)
      .eq('user_id', user.id) // Extra safety check
      .eq('activity_type', 'comment')

    if (error) {
      console.error('Error deleting comment:', error)
      return { error: 'Failed to delete comment. You can only delete your own comments.' }
    }

    console.log('Comment deleted successfully')

    // Revalidate the ticket page
    revalidatePath(`/tickets/${ticketId}`)

    return { success: true }
  } catch (error) {
    console.error('Server error deleting comment:', error)
    return { error: 'Failed to delete comment' }
  }
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