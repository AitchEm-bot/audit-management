import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ExcelReportGenerator } from '@/lib/excel-export'
import { format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    console.log("API route: Starting report generation...")

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("API route: Authentication failed:", authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { filters, options } = body

    console.log("API route: Received filters:", filters)
    console.log("API route: Received options:", options)

    // Build query with server-side filtering
    let query = supabase.from("audit_tickets").select("*")

    console.log("API route: Building query with filters...")
    console.log("API route: Status filter:", filters.status)
    console.log("API route: Priority filter:", filters.priority)
    console.log("API route: Department filter:", filters.department)
    console.log("API route: Date range filter:", filters.dateRange)

    // Apply filters server-side
    if (filters.status && filters.status.length > 0) {
      console.log("API route: Applying status filter:", filters.status)
      query = query.in("status", filters.status)
    }

    if (filters.priority && filters.priority.length > 0) {
      console.log("API route: Applying priority filter:", filters.priority)
      query = query.in("priority", filters.priority)
    }

    if (filters.department && filters.department.length > 0) {
      console.log("API route: Applying department filter:", filters.department)
      query = query.in("department", filters.department)
    }

    if (filters.dateRange) {
      console.log("API route: Applying date range filter:", filters.dateRange)
      query = query
        .gte("created_at", filters.dateRange.start)
        .lte("created_at", filters.dateRange.end + "T23:59:59")
    }

    // Order by created_at for consistent results
    query = query.order("created_at", { ascending: false })

    // First, let's try a simple query to see if we can fetch any tickets at all
    console.log("API route: Testing basic ticket query...")
    const { data: allTickets, error: testError } = await supabase
      .from("audit_tickets")
      .select("*")
      .limit(5)

    console.log("API route: Basic query result - tickets:", allTickets?.length || 0, "error:", testError)

    console.log("API route: Executing filtered ticket query...")
    const { data: tickets, error: ticketError } = await query

    if (ticketError) {
      console.error("API route: Ticket query error:", ticketError)
      return NextResponse.json({
        error: `Failed to fetch ticket data: ${ticketError.message}`
      }, { status: 500 })
    }

    console.log("API route: Found", tickets?.length || 0, "tickets")

    if (!tickets || tickets.length === 0) {
      // If no tickets found with filters, let's also try without any filters as fallback
      console.log("API route: No tickets with filters, trying without filters...")
      const { data: fallbackTickets, error: fallbackError } = await supabase
        .from("audit_tickets")
        .select("*")
        .order("created_at", { ascending: false })

      console.log("API route: Fallback query result - tickets:", fallbackTickets?.length || 0, "error:", fallbackError)

      if (fallbackError) {
        console.error("API route: Fallback query error:", fallbackError)
        return NextResponse.json({
          error: `Database query failed: ${fallbackError.message}`
        }, { status: 500 })
      }

      if (!fallbackTickets || fallbackTickets.length === 0) {
        return NextResponse.json({
          error: 'No audit tickets found in the database. Please ensure tickets have been created.'
        }, { status: 400 })
      } else {
        return NextResponse.json({
          error: `No tickets found matching the selected filters. Found ${fallbackTickets.length} total tickets in database. Please adjust your filters and try again.`
        }, { status: 400 })
      }
    }

    // Fetch comments if requested
    let comments: any[] = []
    if (options.includeComments && tickets.length > 0) {
      console.log("API route: Fetching comments for tickets...")
      const ticketIds = tickets.map(t => t.id)

      const { data: commentData, error: commentError } = await supabase
        .from("ticket_activities")
        .select("*")
        .eq("activity_type", "comment")
        .in("ticket_id", ticketIds)

      if (!commentError && commentData) {
        comments = commentData.map(comment => ({
          ...comment,
          ticket_id: comment.ticket_id,
          ticket_number: tickets.find(t => t.id === comment.ticket_id)?.ticket_number
        }))
        console.log("API route: Found", comments.length, "comments")
      } else if (commentError) {
        console.warn("API route: Comment query failed:", commentError)
        // Continue without comments rather than failing entirely
      }
    }

    // Fetch user profiles for ticket creators, assignees, and comment authors
    console.log("API route: Fetching user profiles...")
    const userIds = [...new Set([
      ...tickets.map(t => t.created_by).filter(Boolean),
      ...tickets.map(t => t.assigned_to).filter(Boolean),
      ...comments.map(c => c.user_id).filter(Boolean)
    ])]

    let profileMap = new Map()
    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, department")
        .in("id", userIds)

      if (!profileError && profiles) {
        profileMap = new Map(profiles.map(p => [p.id, p]))
        console.log("API route: Found", profiles.length, "user profiles")
      } else if (profileError) {
        console.warn("API route: Profile query failed:", profileError)
        // Continue without profiles rather than failing entirely
      }
    }

    // Enrich comments with profile data
    const enrichedComments = comments.map(comment => ({
      ...comment,
      profiles: profileMap.get(comment.user_id) || null
    }))

    // Enrich tickets with profile data and comments
    const enrichedTickets = tickets.map(ticket => ({
      ...ticket,
      profiles: profileMap.get(ticket.created_by) || null,
      assigned_profile: profileMap.get(ticket.assigned_to) || null,
      audit_comments: enrichedComments.filter(c => c.ticket_id === ticket.id) || []
    }))

    console.log("API route: Generating Excel workbook...")

    // Generate Excel report
    const workbook = ExcelReportGenerator.generateTicketReport(enrichedTickets, comments, {
      includeComments: options.includeComments,
      includeMetrics: options.includeMetrics,
      filterStatus: filters.status?.length > 0 ? filters.status : undefined,
      filterPriority: filters.priority?.length > 0 ? filters.priority : undefined,
      filterDepartment: filters.department?.length > 0 ? filters.department : undefined,
      dateRange: filters.dateRange || undefined,
    })

    console.log("API route: Converting workbook to buffer...")

    // Convert workbook to buffer
    const buffer = ExcelReportGenerator.workbookToBuffer(workbook)

    // Generate filename
    const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm")
    const filename = `audit-report_${timestamp}.xlsx`

    console.log("API route: Returning file:", filename)

    // Return the Excel file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })

  } catch (error) {
    console.error("API route: Unexpected error:", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 })
  }
}