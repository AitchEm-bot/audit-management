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
   * Optimized query for fetching paginated tickets with eager loading
   */
  async getTicketsPaginated(
    filters: TicketFilters = {},
    pagination: PaginationParams = {},
    sort: SortOptions = { column: "created_at", ascending: false }
  ) {
    const { page = 1, pageSize = 50 } = pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

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
        profiles:created_by (
          id,
          full_name,
          email
        ),
        assigned_profile:assigned_to (
          id,
          full_name,
          email
        )
      `,
        { count: "exact" }
      )

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

    // Full-text search using PostgreSQL's text search capabilities
    if (filters.searchTerm) {
      query = query.textSearch("title", filters.searchTerm, {
        type: "websearch",
        config: "english",
      })
    }

    // Apply sorting
    query = query.order(sort.column, { ascending: sort.ascending })

    // Apply pagination
    query = query.range(from, to)

    const { data, error, count } = await query

    return {
      data,
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
   * Optimized query for dashboard statistics using database function
   */
  async getDashboardStats() {
    // Use the optimized database function instead of multiple queries
    const { data, error } = await this.supabase.rpc("get_dashboard_stats")

    if (error) {
      // Fallback to manual aggregation if function doesn't exist
      return this.getDashboardStatsFallback()
    }

    return { data, error }
  }

  /**
   * Fallback method for dashboard stats
   */
  private async getDashboardStatsFallback() {
    const { data: tickets, error } = await this.supabase
      .from("audit_tickets")
      .select("status, priority, department, due_date, created_at")

    if (error) return { data: null, error }

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
      // Status counts
      if (ticket.status in stats) {
        (stats as any)[ticket.status]++
      }

      // Priority counts
      if (ticket.priority in stats) {
        (stats as any)[ticket.priority]++
      }

      // Department counts
      stats.departments[ticket.department] = (stats.departments[ticket.department] || 0) + 1

      // Overdue tickets
      if (
        ticket.due_date &&
        new Date(ticket.due_date) < now &&
        ticket.status !== "resolved" &&
        ticket.status !== "closed"
      ) {
        stats.overdue++
      }

      // Recent activity
      if (new Date(ticket.created_at) > sevenDaysAgo) {
        stats.recent_7_days++
      }
    })

    return { data: stats, error: null }
  }

  /**
   * Optimized query for report generation with batched operations
   */
  async getTicketsForReport(filters: TicketFilters = {}) {
    // Build the base query with all necessary joins
    let query = this.supabase.from("audit_tickets").select(
      `
      *,
      profiles:created_by (
        id,
        full_name,
        email,
        department
      ),
      assigned_profile:assigned_to (
        id,
        full_name,
        email,
        department
      ),
      audit_comments (
        id,
        comment,
        created_at,
        profiles:user_id (
          id,
          full_name,
          email
        )
      ),
      ticket_activities (
        id,
        activity_type,
        content,
        old_value,
        new_value,
        created_at,
        profiles:user_id (
          id,
          full_name,
          email
        )
      )
    `
    )

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

    const { data, error } = await query

    return { data, error }
  }

  /**
   * Get department statistics from materialized view
   */
  async getDepartmentStats() {
    const { data, error } = await this.supabase.from("mv_department_stats").select("*").order("total_tickets", { ascending: false })

    return { data, error }
  }

  /**
   * Get daily metrics from materialized view
   */
  async getDailyMetrics(days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await this.supabase
      .from("mv_daily_metrics")
      .select("*")
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: false })

    return { data, error }
  }

  /**
   * Batch fetch tickets by IDs (optimized for report generation)
   */
  async getTicketsByIds(ticketIds: string[]) {
    // Batch the IDs to avoid query size limits
    const batchSize = 100
    const batches = []

    for (let i = 0; i < ticketIds.length; i += batchSize) {
      batches.push(ticketIds.slice(i, i + batchSize))
    }

    const results = await Promise.all(
      batches.map((batch) =>
        this.supabase
          .from("audit_tickets")
          .select(
            `
          *,
          profiles:created_by (full_name, email),
          assigned_profile:assigned_to (full_name, email)
        `
          )
          .in("id", batch)
      )
    )

    const allData = results.flatMap((result) => result.data || [])
    const hasError = results.some((result) => result.error)

    return {
      data: allData,
      error: hasError ? new Error("Failed to fetch some tickets") : null,
    }
  }

  /**
   * Get unique departments with caching
   */
  async getDepartments() {
    const { data, error } = await this.supabase
      .from("audit_tickets")
      .select("department")
      .not("department", "is", null)
      .order("department")

    if (error) return { data: [], error }

    // Extract unique departments
    const uniqueDepartments = [...new Set(data?.map((item) => item.department) || [])]

    return { data: uniqueDepartments, error: null }
  }

  /**
   * Refresh materialized views for up-to-date statistics
   */
  async refreshMaterializedViews() {
    const { error } = await this.supabase.rpc("refresh_materialized_views")
    return { error }
  }

  /**
   * Get ticket with all related data (optimized single query)
   */
  async getTicketDetails(ticketId: string) {
    const { data, error } = await this.supabase
      .from("audit_tickets")
      .select(
        `
        *,
        profiles:created_by (
          id,
          full_name,
          email,
          department,
          role
        ),
        assigned_profile:assigned_to (
          id,
          full_name,
          email,
          department,
          role
        ),
        audit_comments (
          id,
          comment,
          created_at,
          profiles:user_id (
            id,
            full_name,
            email,
            department
          )
        ),
        audit_attachments (
          id,
          filename,
          file_path,
          file_size,
          mime_type,
          created_at,
          profiles:uploaded_by (
            id,
            full_name,
            email
          )
        ),
        ticket_activities (
          id,
          activity_type,
          content,
          old_value,
          new_value,
          created_at,
          profiles:user_id (
            id,
            full_name,
            email
          )
        )
      `
      )
      .eq("id", ticketId)
      .single()

    return { data, error }
  }

  /**
   * Cursor-based pagination for infinite scroll
   */
  async getTicketsWithCursor(
    filters: TicketFilters = {},
    cursor?: string,
    limit: number = 20
  ) {
    let query = this.supabase
      .from("audit_tickets")
      .select(
        `
        id,
        ticket_number,
        title,
        department,
        priority,
        status,
        due_date,
        created_at,
        profiles:created_by (full_name),
        assigned_profile:assigned_to (full_name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit)

    // Apply cursor if provided
    if (cursor) {
      query = query.lt("created_at", cursor)
    }

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

    const { data, error } = await query

    const nextCursor = data && data.length === limit ? data[data.length - 1].created_at : null

    return {
      data,
      error,
      nextCursor,
      hasMore: data && data.length === limit,
    }
  }
}

// Export a factory function to create queries instance
export function createSupabaseQueries(supabase: SupabaseClient) {
  return new SupabaseQueries(supabase)
}