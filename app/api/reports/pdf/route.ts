import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PdfReportGenerator, PdfGenerationData, PdfOptions } from '@/lib/pdf-export'
import { AIReportGenerator, Ticket } from '@/lib/ai-report-generator'
import { format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    console.log("PDF API: Starting PDF report generation...")

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("PDF API: Authentication failed:", authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { filters, pdfOptions } = body as {
      filters: {
        status?: string[]
        priority?: string[]
        department?: string[]
        dateRange?: { start: string; end: string }
      }
      pdfOptions: PdfOptions
    }

    console.log("PDF API: Received filters:", filters)
    console.log("PDF API: Received pdfOptions:", pdfOptions)

    // Build query with server-side filtering
    let query = supabase.from("audit_tickets").select("*")

    // Apply filters server-side
    if (filters.status && filters.status.length > 0) {
      console.log("PDF API: Applying status filter:", filters.status)
      query = query.in("status", filters.status)
    }

    if (filters.priority && filters.priority.length > 0) {
      console.log("PDF API: Applying priority filter:", filters.priority)
      query = query.in("priority", filters.priority)
    }

    if (filters.department && filters.department.length > 0) {
      console.log("PDF API: Applying department filter:", filters.department)
      query = query.in("department", filters.department)
    }

    if (filters.dateRange) {
      console.log("PDF API: Applying date range filter:", filters.dateRange)
      query = query
        .gte("created_at", filters.dateRange.start)
        .lte("created_at", filters.dateRange.end + "T23:59:59")
    }

    // Order by created_at for consistent results
    query = query.order("created_at", { ascending: false })

    console.log("PDF API: Executing ticket query...")
    const { data: tickets, error: ticketError } = await query

    if (ticketError) {
      console.error("PDF API: Ticket query error:", ticketError)
      return NextResponse.json({
        error: `Failed to fetch ticket data: ${ticketError.message}`
      }, { status: 500 })
    }

    console.log("PDF API: Found", tickets?.length || 0, "tickets")

    if (!tickets || tickets.length === 0) {
      return NextResponse.json({
        error: 'No tickets found matching the selected filters. Please adjust your filters and try again.'
      }, { status: 400 })
    }

    // Fetch user profiles for ticket creators, assignees
    console.log("PDF API: Fetching user profiles...")
    const userIds = [...new Set([
      ...tickets.map(t => t.created_by).filter(Boolean),
      ...tickets.map(t => t.assigned_to).filter(Boolean)
    ])]

    let profileMap = new Map()
    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, department")
        .in("id", userIds)

      if (!profileError && profiles) {
        profileMap = new Map(profiles.map(p => [p.id, p]))
        console.log("PDF API: Found", profiles.length, "user profiles")
      } else if (profileError) {
        console.warn("PDF API: Profile query failed:", profileError)
      }
    }

    // Enrich tickets with profile data
    let enrichedTickets = tickets.map(ticket => ({
      ...ticket,
      profiles: profileMap.get(ticket.created_by) || null,
      assigned_profile: profileMap.get(ticket.assigned_to) || null,
      audit_comments: []
    }))

    // Fetch comments if requested
    if (pdfOptions.includeAllComments && tickets.length > 0) {
      console.log("PDF API: Fetching comments for tickets...")
      const ticketIds = tickets.map(t => t.id)

      const { data: commentData, error: commentError } = await supabase
        .from("ticket_activities")
        .select("*")
        .eq("activity_type", "comment")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true })

      if (!commentError && commentData) {
        console.log("PDF API: Found", commentData.length, "comments")

        // Fetch comment author profiles
        const commentUserIds = [...new Set(commentData.map(c => c.user_id).filter(Boolean))]
        let commentProfileMap = new Map()

        if (commentUserIds.length > 0) {
          const { data: commentProfiles, error: commentProfileError } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", commentUserIds)

          if (!commentProfileError && commentProfiles) {
            commentProfileMap = new Map(commentProfiles.map(p => [p.id, p]))
          }
        }

        // Enrich comments with profiles
        const enrichedComments = commentData.map(comment => ({
          ...comment,
          profiles: commentProfileMap.get(comment.user_id) || null
        }))

        // Attach comments to tickets
        enrichedTickets = enrichedTickets.map(ticket => ({
          ...ticket,
          audit_comments: enrichedComments.filter(c => c.ticket_id === ticket.id)
        }))
      } else if (commentError) {
        console.warn("PDF API: Comment query failed:", commentError)
        // Continue without comments
      }
    }

    console.log("PDF API: Generating AI content...")

    // Generate executive summary using AI
    const executiveSummary = await AIReportGenerator.generateExecutiveSummary(
      enrichedTickets as unknown as Ticket[]
    )

    console.log("PDF API: Executive summary generated")

    // Generate action plans for each ticket using AI
    const actionPlans = await AIReportGenerator.generateActionPlans(
      enrichedTickets as unknown as Ticket[]
    )

    console.log("PDF API: Action plans generated for", actionPlans.size, "tickets")

    // Prepare data for PDF generation
    const pdfData: PdfGenerationData = {
      tickets: enrichedTickets,
      executiveSummary,
      actionPlans,
      options: pdfOptions,
      filters: {
        status: filters.status,
        priority: filters.priority,
        department: filters.department,
        dateRange: filters.dateRange
      }
    }

    console.log("PDF API: Generating PDF...")

    // Generate PDF
    const pdfGenerator = new PdfReportGenerator(pdfOptions.locale)
    const pdfBuffer = await pdfGenerator.generate(pdfData)

    console.log("PDF API: PDF generated successfully, size:", pdfBuffer.length, "bytes")

    // Generate filename
    const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm")
    const filename = `audit-report_${timestamp}.pdf`

    console.log("PDF API: Returning PDF file:", filename)

    // Return the PDF file
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error("PDF API: Unexpected error:", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 })
  }
}
