import { SupabaseClient } from "@supabase/supabase-js"

export interface PaginationParams {
  page?: number
  pageSize?: number
  cursor?: string
}

export interface TicketFilters {
  status?: string | string[]
  priority?: string | string[]
  department?: string | string[]
  assignedTo?: string
  createdBy?: string
  dateRange?: {
    start: string
    end: string
  }
  searchTerm?: string
}

export interface SortOptions {
  column: string
  ascending?: boolean
}

export class SupabaseQueries {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get current user's profile with role and department
   */
  async getCurrentUserProfile() {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id, full_name, email, department, role")
      .eq("id", user.id)
      .single()

    return profile
  }

  /**
   * Simplified query for fetching paginated tickets (basic functionality)
   * Now includes role-based department filtering
   */
  async getTicketsPaginated(
    filters: TicketFilters = {},
    pagination: PaginationParams = {},
    sort: SortOptions = { column: "created_at", ascending: false },
    userProfile?: any // Optional user profile for role-based filtering
  ) {
    console.log("getTicketsPaginated called with:", { filters, pagination, sort, userRole: userProfile?.role })
    const { page = 1, pageSize = 50 } = pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    console.log("getTicketsPaginated: Pagination calculated:", { page, pageSize, from, to })

    // Start with basic query without joins to avoid relationship errors
    let query = this.supabase
      .from("audit_tickets")
      .select(
        `
        id,
        ticket_number,
        title,
        description,
        department,
        priority,
        status,
        due_date,
        created_at,
        updated_at,
        created_by,
        assigned_to,
        requires_manager_approval,
        approval_status
      `,
        { count: "exact" }
      )

    // Apply role-based department filtering BEFORE other filters
    if (userProfile) {
      if (userProfile.role === 'manager' && userProfile.department) {
        // Managers see only their department + General tickets
        query = query.or(`department.eq.${userProfile.department},department.eq.General,department.is.null`)
        console.log(`Manager filter applied: showing ${userProfile.department} and General tickets`)
      } else if (userProfile.role === 'emp' && userProfile.department) {
        // Employees see their department tickets + tickets they created or are assigned to
        const { data: { user } } = await this.supabase.auth.getUser()
        if (user) {
          query = query.or(`department.eq.${userProfile.department},department.eq.General,created_by.eq.${user.id},assigned_to.eq.${user.id}`)
          console.log(`Employee filter applied: showing ${userProfile.department}, General, and personal tickets`)
        }
      }
      // Admins and Execs see everything (no additional filtering)
    }

    // Apply filters
    if (filters.status === "active") {
      // Special filter to exclude closed and resolved tickets
      query = query.not("status", "in", "(closed,resolved)")
    } else if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      query = query.in("status", statuses)
    }

    if (filters.priority) {
      const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority]
      query = query.in("priority", priorities)
    }

    // Department filter should respect role-based filtering
    if (filters.department) {
      const departments = Array.isArray(filters.department) ? filters.department : [filters.department]
      // For managers, only allow filtering within their accessible departments
      if (userProfile?.role === 'manager' && userProfile.department) {
        const allowedDepts = departments.filter(d =>
          d === userProfile.department || d === 'General'
        )
        if (allowedDepts.length > 0) {
          query = query.in("department", allowedDepts)
        }
      } else {
        query = query.in("department", departments)
      }
    }

    if (filters.assignedTo) {
      query = query.eq("assigned_to", filters.assignedTo)
    }

    if (filters.createdBy) {
      query = query.eq("created_by", filters.createdBy)
    }

    if (filters.dateRange) {
      query = query
        .gte("created_at", filters.dateRange.start)
        .lte("created_at", filters.dateRange.end + "T23:59:59")
    }

    // Full-text search using simple ILIKE for now
    if (filters.searchTerm) {
      query = query.or(`title.ilike.%${filters.searchTerm}%,description.ilike.%${filters.searchTerm}%`)
    }

    // Apply sorting
    query = query.order(sort.column, { ascending: sort.ascending })

    // Apply pagination
    query = query.range(from, to)

    console.log("getTicketsPaginated: About to execute query...")
    const { data, error, count } = await query
    console.log("getTicketsPaginated: Query result:", {
      dataLength: data?.length,
      error,
      count
    })

    // If we got data, try to enrich it with profile information
    let enrichedData = data
    if (data && data.length > 0) {
      enrichedData = await this.enrichTicketsWithProfiles(data)
    }

    return {
      data: enrichedData,
      error,
      count,
      pageInfo: {
        currentPage: page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
        hasNextPage: to < (count || 0) - 1,
        hasPreviousPage: page > 1,
      },
    }
  }

  /**
   * Enrich tickets with profile data (separate queries to avoid join issues)
   */
  private async enrichTicketsWithProfiles(tickets: any[]) {
    try {
      // Get unique user IDs
      const userIds = [...new Set([
        ...tickets.map(t => t.created_by).filter(Boolean),
        ...tickets.map(t => t.assigned_to).filter(Boolean)
      ])]

      if (userIds.length === 0) return tickets

      // Fetch profiles in a separate query
      const { data: profiles } = await this.supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

      // Enrich tickets with profile data
      return tickets.map(ticket => ({
        ...ticket,
        profiles: ticket.created_by ? profileMap.get(ticket.created_by) : null,
        assigned_profile: ticket.assigned_to ? profileMap.get(ticket.assigned_to) : null
      }))
    } catch (error) {
      console.warn("Failed to enrich tickets with profiles:", error)
      return tickets // Return tickets without profile data if enrichment fails
    }
  }

  /**
   * Dashboard statistics with automatic fallback and role-based filtering
   */
  async getDashboardStats(userProfile?: any) {
    // Skip optimized function for now, go directly to fallback until we fix it
    console.log("getDashboardStats: Starting stats fetch", { userRole: userProfile?.role })
    const result = await this.getDashboardStatsFallback(userProfile)
    console.log("getDashboardStats: Result received:", result)
    return result
  }

  /**
   * Fallback method for dashboard stats with role-based filtering
   */
  private async getDashboardStatsFallback(userProfile?: any) {
    try {
      console.log("getDashboardStatsFallback: Starting ticket query", { userRole: userProfile?.role })

      // Build query with role-based filtering
      let query = this.supabase
        .from("audit_tickets")
        .select("status, priority, department, due_date, created_at, created_by, assigned_to")

      // Apply role-based filtering
      if (userProfile) {
        if (userProfile.role === 'manager' && userProfile.department) {
          // Managers see only their department + General
          query = query.or(`department.eq.${userProfile.department},department.eq.General,department.is.null`)
        } else if (userProfile.role === 'emp') {
          // Employees see their department + personal tickets
          const { data: { user } } = await this.supabase.auth.getUser()
          if (user && userProfile.department) {
            query = query.or(`department.eq.${userProfile.department},department.eq.General,created_by.eq.${user.id},assigned_to.eq.${user.id}`)
          }
        }
        // Admins and Execs see everything
      }

      // Add timeout to prevent hanging
      const queryPromise = query

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout after 10 seconds")), 10000)
      )

      const { data: tickets, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      console.log("getDashboardStatsFallback: Query completed", { ticketCount: tickets?.length, error })

      if (error) {
        console.error("getDashboardStatsFallback: Error fetching tickets for stats:", error)
        return { data: null, error }
      }

      console.log("Dashboard fallback: fetched tickets:", tickets?.length)
      if (tickets && tickets.length > 0) {
        console.log("Sample ticket:", tickets[0])
        console.log("All statuses:", [...new Set(tickets.map(t => t.status))])
        console.log("All priorities:", [...new Set(tickets.map(t => t.priority))])
        console.log("Raw tickets data:", tickets)
      } else {
        console.log("No tickets found or tickets array is empty")
      }

      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const stats = {
        total: tickets?.length || 0,
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        overdue: 0,
        recent_7_days: 0,
        departments: {} as Record<string, number>,
      }

      tickets?.forEach((ticket) => {
        // Status counts - handle potential case mismatch or different values
        const status = ticket.status?.toLowerCase()
        if (status === "open" || status === "new") {
          stats.open++
        } else if (status === "in_progress" || status === "in progress" || status === "inprogress") {
          stats.in_progress++
        } else if (status === "resolved") {
          stats.resolved++
        } else if (status === "closed") {
          stats.closed++
        }

        // Priority counts - handle potential case mismatch
        const priority = ticket.priority?.toLowerCase()
        if (priority === "critical") {
          stats.critical++
        } else if (priority === "high") {
          stats.high++
        } else if (priority === "medium") {
          stats.medium++
        } else if (priority === "low") {
          stats.low++
        }

        // Department counts
        if (ticket.department) {
          stats.departments[ticket.department] = (stats.departments[ticket.department] || 0) + 1
        }

        // Overdue tickets
        if (
          ticket.due_date &&
          new Date(ticket.due_date) < now &&
          status !== "resolved" &&
          status !== "closed"
        ) {
          stats.overdue++
        }

        // Recent activity
        if (new Date(ticket.created_at) > sevenDaysAgo) {
          stats.recent_7_days++
        }
      })

      console.log("Dashboard fallback calculated stats:", stats)
      return { data: stats, error: null }
    } catch (error) {
      console.error("Error in fallback stats calculation:", error)
      return {
        data: {
          total: 0,
          open: 0,
          in_progress: 0,
          resolved: 0,
          closed: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          overdue: 0,
          recent_7_days: 0,
          departments: {},
        },
        error: null
      }
    }
  }

  /**
   * Simplified query for report generation (basic functionality)
   */
  async getTicketsForReport(filters: TicketFilters = {}) {
    console.log("getTicketsForReport: Starting with filters:", filters)

    try {
      // Use basic query first to avoid relationship errors
      let query = this.supabase.from("audit_tickets").select("*")

      // Apply filters
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
        query = query.in("status", statuses)
      }

      if (filters.priority) {
        const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority]
        query = query.in("priority", priorities)
      }

      if (filters.department) {
        const departments = Array.isArray(filters.department) ? filters.department : [filters.department]
        query = query.in("department", departments)
      }

      if (filters.dateRange) {
        query = query
          .gte("created_at", filters.dateRange.start)
          .lte("created_at", filters.dateRange.end + "T23:59:59")
      }

      // Order by created_at for consistent results
      query = query.order("created_at", { ascending: false })

      console.log("getTicketsForReport: Executing main query...")

      // Add timeout protection to prevent hanging
      const queryPromise = query
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Ticket query timeout after 20 seconds")), 20000)
      )

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      if (error) {
        console.error("getTicketsForReport: Query error:", error)
        return { data: [], error }
      }

      console.log("getTicketsForReport: Main query completed, tickets found:", data?.length || 0)

      // Enrich with additional data if needed
      const enrichedData = data ? await this.enrichTicketsForReport(data, filters) : []

      console.log("getTicketsForReport: Enrichment completed, final count:", enrichedData?.length || 0)
      return { data: enrichedData, error: null }
    } catch (error) {
      console.error("getTicketsForReport: Unexpected error:", error)
      return {
        data: [],
        error: error instanceof Error ? error : new Error("Unknown error in report data fetch")
      }
    }
  }

  /**
   * Enrich tickets for reports with comments and profiles
   */
  private async enrichTicketsForReport(tickets: any[], filters: TicketFilters) {
    if (!tickets || tickets.length === 0) return tickets

    console.log("enrichTicketsForReport: Starting enrichment for", tickets.length, "tickets")

    try {
      const ticketIds = tickets.map(t => t.id)
      const userIds = [...new Set([
        ...tickets.map(t => t.created_by).filter(Boolean),
        ...tickets.map(t => t.assigned_to).filter(Boolean)
      ])]

      console.log("enrichTicketsForReport: Fetching", userIds.length, "profiles and comments for", ticketIds.length, "tickets")

      // Add timeout protection to enrichment queries
      const enrichmentPromise = Promise.all([
        userIds.length > 0 ? this.supabase
          .from("profiles")
          .select("id, full_name, email, department")
          .in("id", userIds) : { data: [] },
        this.supabase
          .from("audit_comments")
          .select("*")
          .in("ticket_id", ticketIds)
      ])

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Enrichment query timeout after 15 seconds")), 15000)
      )

      // Fetch profiles and comments separately to avoid join issues
      const [profilesResult, commentsResult] = await Promise.race([
        enrichmentPromise,
        timeoutPromise
      ]) as any

      console.log("enrichTicketsForReport: Enrichment queries completed")

      const profileMap = new Map(profilesResult.data?.map(p => [p.id, p]) || [])
      const commentsByTicket = new Map()

      commentsResult.data?.forEach(comment => {
        if (!commentsByTicket.has(comment.ticket_id)) {
          commentsByTicket.set(comment.ticket_id, [])
        }
        commentsByTicket.get(comment.ticket_id).push({
          ...comment,
          profiles: profileMap.get(comment.user_id)
        })
      })

      console.log("enrichTicketsForReport: Processing completed, comments found:", commentsResult.data?.length || 0)

      // Enrich tickets with related data
      return tickets.map(ticket => ({
        ...ticket,
        profiles: profileMap.get(ticket.created_by) || null,
        assigned_profile: profileMap.get(ticket.assigned_to) || null,
        audit_comments: commentsByTicket.get(ticket.id) || []
      }))
    } catch (error) {
      console.warn("enrichTicketsForReport: Failed to enrich tickets, returning basic data:", error)
      // Return tickets without enrichment if enrichment fails
      return tickets
    }
  }

  /**
   * Get department statistics from materialized view (with fallback)
   */
  async getDepartmentStats() {
    try {
      const { data, error } = await this.supabase.from("mv_department_stats").select("*").order("total_tickets", { ascending: false })

      if (!error && data) {
        return { data, error: null }
      }
    } catch (error) {
      console.log("Materialized view not available, using fallback")
    }

    // Fallback to manual calculation
    return this.getDepartmentStatsFallback()
  }

  private async getDepartmentStatsFallback() {
    try {
      const { data: tickets, error } = await this.supabase
        .from("audit_tickets")
        .select("department, status, priority, due_date, created_at, updated_at")

      if (error) return { data: [], error }

      const deptStats = new Map()
      const now = new Date()

      tickets?.forEach(ticket => {
        const dept = ticket.department
        if (!deptStats.has(dept)) {
          deptStats.set(dept, {
            department: dept,
            total_tickets: 0,
            open_tickets: 0,
            in_progress_tickets: 0,
            resolved_tickets: 0,
            closed_tickets: 0,
            critical_tickets: 0,
            high_tickets: 0,
            overdue_tickets: 0,
            avg_resolution_days: 0
          })
        }

        const stats = deptStats.get(dept)
        stats.total_tickets++
        stats[`${ticket.status}_tickets`] = (stats[`${ticket.status}_tickets`] || 0) + 1
        stats[`${ticket.priority}_tickets`] = (stats[`${ticket.priority}_tickets`] || 0) + 1

        if (ticket.due_date && new Date(ticket.due_date) < now && !['resolved', 'closed'].includes(ticket.status)) {
          stats.overdue_tickets++
        }
      })

      return { data: Array.from(deptStats.values()), error: null }
    } catch (error) {
      console.error("Error calculating department stats:", error)
      return { data: [], error }
    }
  }

  /**
   * Get daily metrics from materialized view (with fallback)
   */
  async getDailyMetrics(days: number = 30) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data, error } = await this.supabase
        .from("mv_daily_metrics")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .order("date", { ascending: false })

      if (!error && data) {
        return { data, error: null }
      }
    } catch (error) {
      console.log("Daily metrics view not available")
    }

    // For now, return empty data since this is less critical
    return { data: [], error: null }
  }

  /**
   * Get unique departments (simplified)
   */
  async getDepartments() {
    try {
      const { data, error } = await this.supabase
        .from("audit_tickets")
        .select("department")
        .not("department", "is", null)

      if (error) {
        console.error("Error fetching departments:", error)
        return { data: [], error }
      }

      // Extract unique departments
      const uniqueDepartments = [...new Set(data?.map((item) => item.department) || [])]
        .filter(Boolean)
        .sort()

      return { data: uniqueDepartments, error: null }
    } catch (error) {
      console.error("Failed to fetch departments:", error)
      return { data: [], error }
    }
  }

  /**
   * Refresh materialized views (with error handling)
   */
  async refreshMaterializedViews() {
    try {
      const { error } = await this.supabase.rpc("refresh_materialized_views")
      return { error }
    } catch (error) {
      console.log("Materialized views function not available yet")
      return { error: null } // Don't treat this as an error for now
    }
  }

  /**
   * Get ticket with all related data (simplified for now)
   */
  async getTicketDetails(ticketId: string) {
    try {
      const { data, error } = await this.supabase
        .from("audit_tickets")
        .select("*")
        .eq("id", ticketId)
        .single()

      if (error || !data) {
        return { data: null, error }
      }

      // Enrich with profiles
      const enrichedTickets = await this.enrichTicketsWithProfiles([data])
      const enrichedTicket = enrichedTickets[0]

      // Get comments
      const { data: comments } = await this.supabase
        .from("audit_comments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true })

      // Get attachments
      const { data: attachments } = await this.supabase
        .from("audit_attachments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true })

      return {
        data: {
          ...enrichedTicket,
          audit_comments: comments || [],
          audit_attachments: attachments || []
        },
        error: null
      }
    } catch (error) {
      console.error("Error fetching ticket details:", error)
      return { data: null, error }
    }
  }

  /**
   * Simple ticket fetch without pagination (for fallbacks)
   */
  async getTicketsBasic() {
    try {
      const { data, error } = await this.supabase
        .from("audit_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20) // Limit to prevent large data loads

      return { data, error }
    } catch (error) {
      console.error("Error fetching basic tickets:", error)
      return { data: [], error }
    }
  }
}

// Export a factory function to create queries instance
export function createSupabaseQueries(supabase: SupabaseClient) {
  return new SupabaseQueries(supabase)
}