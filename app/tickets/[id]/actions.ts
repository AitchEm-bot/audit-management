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
  const files = formData.getAll('files') as File[]
  const hasFiles = files.length > 0 && files[0].size > 0

  console.log('📝 addComment called:')
  console.log('  - ticketId:', ticketId)
  console.log('  - content:', content ? `"${content.substring(0, 50)}..."` : '(empty)')
  console.log('  - files count:', files.length)
  console.log('  - files details:', files.map(f => ({
    name: f.name,
    size: f.size,
    type: f.type
  })))
  console.log('  - hasFiles:', hasFiles)

  // Require either content or files (file-only comments are allowed)
  if ((!content || !content.trim()) && !hasFiles) {
    console.log('❌ Validation failed: no content and no files')
    redirect(`/tickets/${ticketId}?error=pleaseProvideCommentOrFile`)
  }

  // Try to insert into ticket_activities table
  // Allow empty content if files are provided (file-only comment)
  const { data: activity, error } = await supabase
    .from('ticket_activities')
    .insert({
      ticket_id: ticketId,
      user_id: user.id,
      activity_type: 'comment',
      content: content ? content.trim() : '',
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error inserting activity:', error)
    if (error.code === 'PGRST205' || error.message.includes('table') || error.message.includes('schema cache')) {
      redirect(`/tickets/${ticketId}?error=Database not ready. Please ask admin to run migration.`)
    } else {
      redirect(`/tickets/${ticketId}?error=Could not add comment: ${error.message}`)
    }
  }

  console.log('✅ Activity created:', activity.id)

  // Handle file uploads
  if (hasFiles && activity) {
    console.log('📎 Starting file upload process...')
    let uploadedCount = 0
    let failedCount = 0

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        console.log(`\n📁 Processing file ${i + 1}/${files.length}:`)
        console.log('  - name:', file.name)
        console.log('  - size:', file.size, 'bytes')
        console.log('  - type:', file.type)

        // Validate file size (50MB max)
        if (file.size > 52428800) {
          console.error('  ❌ File too large:', file.name, file.size)
          failedCount++
          continue
        }

        // Upload file to Supabase Storage
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${activity.id}/${Date.now()}_${file.name}`
        console.log('  📤 Uploading to storage:', fileName)

        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('ticket-attachments')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('  ❌ Upload error:', uploadError)
          failedCount++
          continue
        }

        console.log('  ✅ Upload successful, path:', uploadData.path)
        console.log('  💾 Saving metadata to database...')

        // Save attachment metadata to database
        const { error: dbError } = await supabase
          .from('ticket_comment_attachments')
          .insert({
            activity_id: activity.id,
            filename: file.name,
            file_path: uploadData.path,
            file_size: file.size,
            mime_type: file.type
          })

        if (dbError) {
          console.error('  ❌ Database error:', dbError)
          console.log('  🗑️ Cleaning up uploaded file...')
          // Try to clean up the uploaded file
          await supabase.storage.from('ticket-attachments').remove([fileName])
          failedCount++
        } else {
          console.log('  ✅ Metadata saved successfully')
          uploadedCount++
        }
      }

      console.log(`\n📊 Upload summary:`)
      console.log(`  - Total files: ${files.length}`)
      console.log(`  - Uploaded: ${uploadedCount}`)
      console.log(`  - Failed: ${failedCount}`)
    } catch (error) {
      console.error('❌ Error handling file uploads:', error)
    }
  } else if (hasFiles && !activity) {
    console.log('⚠️ Files present but no activity created')
  } else {
    console.log('ℹ️ No files to upload')
  }

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

export async function updateComment(activityId: string, newContent: string, formData?: FormData) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check if comment has attachments - if so, empty content is allowed
  const { data: existingComment } = await supabase
    .from('ticket_activities')
    .select(`
      id,
      ticket_comment_attachments (id)
    `)
    .eq('id', activityId)
    .single()

  const hasAttachments = existingComment?.ticket_comment_attachments &&
                        existingComment.ticket_comment_attachments.length > 0

  // Require content if there are no attachments
  if ((!newContent || !newContent.trim()) && !hasAttachments) {
    return { error: 'Comment must have either content or attachments' }
  }

  try {
    // Update the comment - RLS policy will ensure user owns the comment
    // Allow empty content if there are attachments
    const { data, error } = await supabase
      .from('ticket_activities')
      .update({ content: newContent ? newContent.trim() : '' })
      .eq('id', activityId)
      .eq('user_id', user.id) // Extra safety check
      .eq('activity_type', 'comment')
      .select('ticket_id')
      .single()

    if (error) {
      console.error('Error updating comment:', error)
      return { error: 'Failed to update comment. You can only edit your own comments.' }
    }

    // Handle new file uploads if formData is provided
    if (formData) {
      const files = formData.getAll('files') as File[]
      if (files.length > 0 && files[0].size > 0) {
        try {
          for (const file of files) {
            // Validate file size (50MB max)
            if (file.size > 52428800) {
              console.error('File too large:', file.name, file.size)
              continue
            }

            // Upload file to Supabase Storage
            const fileName = `${user.id}/${activityId}/${Date.now()}_${file.name}`

            const { data: uploadData, error: uploadError } = await supabase
              .storage
              .from('ticket-attachments')
              .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
              })

            if (uploadError) {
              console.error('Error uploading file:', uploadError)
              continue
            }

            // Save attachment metadata to database
            await supabase
              .from('ticket_comment_attachments')
              .insert({
                activity_id: activityId,
                filename: file.name,
                file_path: uploadData.path,
                file_size: file.size,
                mime_type: file.type
              })
          }
        } catch (error) {
          console.error('Error handling file uploads:', error)
        }
      }
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

export async function deleteAttachment(attachmentId: string, filePath: string) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    // Delete from storage first
    const { error: storageError } = await supabase
      .storage
      .from('ticket-attachments')
      .remove([filePath])

    if (storageError) {
      console.error('Error deleting file from storage:', storageError)
      // Continue anyway - we still want to delete the DB record
    }

    // Delete from database (this will trigger the log_attachment_deleted function)
    const { error: dbError } = await supabase
      .from('ticket_comment_attachments')
      .delete()
      .eq('id', attachmentId)

    if (dbError) {
      console.error('Error deleting attachment from database:', dbError)
      return { error: 'Failed to delete attachment. You can only delete your own attachments.' }
    }

    return { success: true }
  } catch (error) {
    console.error('Server error deleting attachment:', error)
    return { error: 'Failed to delete attachment' }
  }
}

export async function closeTicketWithComment(ticketId: string, closingComment: string, aiGenerated = false) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  if (!closingComment || closingComment.trim().length < 10) {
    return { error: 'Closing comment must be at least 10 characters' }
  }

  try {
    // First get the current status
    const { data: currentTicket } = await supabase
      .from('audit_tickets')
      .select('status')
      .eq('id', ticketId)
      .single()

    // Update the ticket status to closed and save closing comment
    const { error } = await supabase
      .from('audit_tickets')
      .update({
        status: 'closed',
        closing_comment: closingComment.trim()
      })
      .eq('id', ticketId)

    if (error) {
      console.error('Error closing ticket:', error)
      return { error: 'Failed to close ticket' }
    }

    // Add closing comment as a regular comment so it's visible in the thread
    // with metadata to mark it as a closing comment
    try {
      await supabase.from('ticket_activities').insert({
        ticket_id: ticketId,
        user_id: user.id,
        activity_type: 'comment',
        content: closingComment.trim(),
        metadata: {
          is_closing_comment: true,
          ai_generated: aiGenerated
        }
      })
    } catch (activityError) {
      console.error('Could not add closing comment to thread:', activityError)
    }

    // Log the ticket closed activity
    try {
      await supabase.from('ticket_activities').insert({
        ticket_id: ticketId,
        user_id: user.id,
        activity_type: 'status_change',
        content: `Status changed from ${currentTicket?.status} to closed`,
        old_value: currentTicket?.status,
        new_value: 'closed',
      })
    } catch (activityError) {
      console.error('Could not log status change activity:', activityError)
      // Continue even if activity logging fails
    }

    console.log('Ticket closed successfully with closing comment')

    // Revalidate the page to show the changes
    revalidatePath(`/tickets/${ticketId}`)

    return { success: true }
  } catch (error) {
    console.error('Server error closing ticket:', error)
    return { error: 'Failed to close ticket' }
  }
}