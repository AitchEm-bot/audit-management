import * as XLSX from "xlsx"

interface TicketData {
  id: string
  ticket_number: string
  title: string
  description: string
  department: string
  priority: string
  status: string
  due_date: string | null
  created_at: string
  updated_at: string
  created_by: string
  assigned_to: string | null
  profiles?: {
    full_name: string
    email: string
  } | null
  assigned_profile?: {
    full_name: string
    email: string
  } | null
}

interface CommentData {
  id: string
  comment: string
  created_at: string
  profiles: {
    full_name: string
    email: string
  }
}

interface ReportOptions {
  includeComments?: boolean
  includeMetrics?: boolean
  filterStatus?: string[]
  filterPriority?: string[]
  filterDepartment?: string[]
  dateRange?: {
    start: string
    end: string
  }
}

export class ExcelReportGenerator {
  static generateTicketReport(tickets: TicketData[], comments: CommentData[] = [], options: ReportOptions = {}) {
    const workbook = XLSX.utils.book_new()

    // Filter tickets based on options
    let filteredTickets = tickets

    if (options.filterStatus && options.filterStatus.length > 0) {
      filteredTickets = filteredTickets.filter((ticket) => options.filterStatus!.includes(ticket.status))
    }

    if (options.filterPriority && options.filterPriority.length > 0) {
      filteredTickets = filteredTickets.filter((ticket) => options.filterPriority!.includes(ticket.priority))
    }

    if (options.filterDepartment && options.filterDepartment.length > 0) {
      filteredTickets = filteredTickets.filter((ticket) => options.filterDepartment!.includes(ticket.department))
    }

    if (options.dateRange) {
      const startDate = new Date(options.dateRange.start)
      const endDate = new Date(options.dateRange.end)
      filteredTickets = filteredTickets.filter((ticket) => {
        const createdDate = new Date(ticket.created_at)
        return createdDate >= startDate && createdDate <= endDate
      })
    }

    // Main tickets worksheet
    const ticketData = filteredTickets.map((ticket) => ({
      "Ticket Number": ticket.ticket_number,
      Title: ticket.title,
      Description: ticket.description,
      Department: ticket.department,
      Priority: ticket.priority,
      Status: ticket.status,
      "Created By": ticket.profiles?.full_name || "Unknown",
      "Assigned To": ticket.assigned_profile?.full_name || "Unassigned",
      "Due Date": ticket.due_date ? new Date(ticket.due_date).toLocaleDateString() : "No due date",
      "Created Date": new Date(ticket.created_at).toLocaleDateString(),
      "Last Updated": new Date(ticket.updated_at).toLocaleDateString(),
    }))

    const ticketWorksheet = XLSX.utils.json_to_sheet(ticketData)

    // Set column widths
    const ticketColWidths = [
      { wch: 20 }, // Ticket Number
      { wch: 30 }, // Title
      { wch: 50 }, // Description
      { wch: 15 }, // Department
      { wch: 10 }, // Priority
      { wch: 12 }, // Status
      { wch: 20 }, // Created By
      { wch: 20 }, // Assigned To
      { wch: 12 }, // Due Date
      { wch: 12 }, // Created Date
      { wch: 12 }, // Last Updated
    ]
    ticketWorksheet["!cols"] = ticketColWidths

    XLSX.utils.book_append_sheet(workbook, ticketWorksheet, "Audit Tickets")

    // Comments worksheet (if requested)
    if (options.includeComments && comments.length > 0) {
      const commentData = comments.map((comment) => ({
        "Ticket ID": comment.id,
        Comment: comment.comment,
        Author: comment.profiles.full_name,
        Date: new Date(comment.created_at).toLocaleDateString(),
        Time: new Date(comment.created_at).toLocaleTimeString(),
      }))

      const commentWorksheet = XLSX.utils.json_to_sheet(commentData)
      const commentColWidths = [
        { wch: 15 }, // Ticket ID
        { wch: 60 }, // Comment
        { wch: 20 }, // Author
        { wch: 12 }, // Date
        { wch: 12 }, // Time
      ]
      commentWorksheet["!cols"] = commentColWidths

      XLSX.utils.book_append_sheet(workbook, commentWorksheet, "Comments")
    }

    // Metrics worksheet (if requested)
    if (options.includeMetrics) {
      const statusCounts = this.calculateStatusCounts(filteredTickets)
      const priorityCounts = this.calculatePriorityCounts(filteredTickets)
      const departmentCounts = this.calculateDepartmentCounts(filteredTickets)

      const metricsData = [
        { Metric: "Total Tickets", Value: filteredTickets.length },
        { Metric: "", Value: "" },
        { Metric: "Status Breakdown", Value: "" },
        ...Object.entries(statusCounts).map(([status, count]) => ({
          Metric: `  ${status.replace("_", " ")}`,
          Value: count,
        })),
        { Metric: "", Value: "" },
        { Metric: "Priority Breakdown", Value: "" },
        ...Object.entries(priorityCounts).map(([priority, count]) => ({
          Metric: `  ${priority}`,
          Value: count,
        })),
        { Metric: "", Value: "" },
        { Metric: "Department Breakdown", Value: "" },
        ...Object.entries(departmentCounts).map(([department, count]) => ({
          Metric: `  ${department}`,
          Value: count,
        })),
      ]

      const metricsWorksheet = XLSX.utils.json_to_sheet(metricsData)
      const metricsColWidths = [{ wch: 25 }, { wch: 15 }]
      metricsWorksheet["!cols"] = metricsColWidths

      XLSX.utils.book_append_sheet(workbook, metricsWorksheet, "Metrics")
    }

    return workbook
  }

  static downloadExcelFile(workbook: XLSX.WorkBook, filename: string) {
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })

    const url = window.URL.createObjectURL(data)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    window.URL.revokeObjectURL(url)
  }

  private static calculateStatusCounts(tickets: TicketData[]) {
    return tickets.reduce(
      (acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
  }

  private static calculatePriorityCounts(tickets: TicketData[]) {
    return tickets.reduce(
      (acc, ticket) => {
        acc[ticket.priority] = (acc[ticket.priority] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
  }

  private static calculateDepartmentCounts(tickets: TicketData[]) {
    return tickets.reduce(
      (acc, ticket) => {
        acc[ticket.department] = (acc[ticket.department] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
  }
}
