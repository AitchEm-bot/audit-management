"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { createSupabaseQueries } from "@/lib/supabase/queries"
import { ExcelReportGenerator } from "@/lib/excel-export"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, FileSpreadsheet, Calendar, Filter, BarChart3 } from "lucide-react"
import { format } from "date-fns"

interface ReportFilters {
  status: string[]
  priority: string[]
  department: string[]
  dateRange: {
    start: string
    end: string
  } | null
}

interface ReportOptions {
  includeComments: boolean
  includeMetrics: boolean
}

export function ReportGenerator() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [ticketCount, setTicketCount] = useState(0)

  // Memoize queries instance
  const queries = useMemo(() => {
    const supabase = createClient()
    return createSupabaseQueries(supabase)
  }, [])

  const [filters, setFilters] = useState<ReportFilters>({
    status: [],
    priority: [],
    department: [],
    dateRange: null,
  })

  const [options, setOptions] = useState<ReportOptions>({
    includeComments: false,
    includeMetrics: true,
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      // Fetch departments and stats in parallel
      const [departmentsResult, statsResult] = await Promise.all([
        queries.getDepartments(),
        queries.getDashboardStats()
      ])

      if (departmentsResult.data) {
        setDepartments(departmentsResult.data)
      }

      if (statsResult.data) {
        setTicketCount(statsResult.data.total || 0)
      }
    } catch (error) {
      console.error("Error fetching initial data:", error)
    }
  }

  const generateReport = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Use optimized query that fetches tickets with all related data in a single query
      const ticketFilters = {
        status: filters.status.length > 0 ? filters.status : undefined,
        priority: filters.priority.length > 0 ? filters.priority : undefined,
        department: filters.department.length > 0 ? filters.department : undefined,
        dateRange: filters.dateRange || undefined,
      }

      const { data: tickets, error: ticketError } = await queries.getTicketsForReport(ticketFilters)

      if (ticketError) throw ticketError

      // Extract comments from the nested data if needed
      let comments: any[] = []
      if (options.includeComments && tickets && tickets.length > 0) {
        // Comments are already included in the tickets data from the optimized query
        comments = tickets.flatMap(ticket =>
          (ticket.audit_comments || []).map((comment: any) => ({
            ...comment,
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number
          }))
        )
      }

      // Generate Excel report
      const workbook = ExcelReportGenerator.generateTicketReport(tickets || [], comments, {
        includeComments: options.includeComments,
        includeMetrics: options.includeMetrics,
        filterStatus: filters.status.length > 0 ? filters.status : undefined,
        filterPriority: filters.priority.length > 0 ? filters.priority : undefined,
        filterDepartment: filters.department.length > 0 ? filters.department : undefined,
        dateRange: filters.dateRange || undefined,
      })

      // Generate filename
      const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm")
      const filename = `audit-report_${timestamp}.xlsx`

      // Download the file
      ExcelReportGenerator.downloadExcelFile(workbook, filename)

      setSuccess(`Report generated successfully! Downloaded ${tickets?.length || 0} tickets.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred generating the report")
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = (status: string, checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      status: checked ? [...prev.status, status] : prev.status.filter((s) => s !== status),
    }))
  }

  const handlePriorityChange = (priority: string, checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      priority: checked ? [...prev.priority, priority] : prev.priority.filter((p) => p !== priority),
    }))
  }

  const handleDepartmentChange = (department: string, checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      department: checked ? [...prev.department, department] : prev.department.filter((d) => d !== department),
    }))
  }

  const clearFilters = () => {
    setFilters({
      status: [],
      priority: [],
      department: [],
      dateRange: null,
    })
  }

  const hasFilters =
    filters.status.length > 0 || filters.priority.length > 0 || filters.department.length > 0 || filters.dateRange

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Generate Audit Report
          </CardTitle>
          <CardDescription>
            Export audit tickets and metrics to Excel format with customizable filters and options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Filters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </h3>
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear All
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {["open", "in_progress", "resolved", "closed"].map((status) => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status}`}
                          checked={filters.status.includes(status)}
                          onCheckedChange={(checked) => handleStatusChange(status, checked as boolean)}
                        />
                        <Label htmlFor={`status-${status}`} className="text-sm capitalize">
                          {status.replace("_", " ")}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Priority</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {["low", "medium", "high", "critical"].map((priority) => (
                      <div key={priority} className="flex items-center space-x-2">
                        <Checkbox
                          id={`priority-${priority}`}
                          checked={filters.priority.includes(priority)}
                          onCheckedChange={(checked) => handlePriorityChange(priority, checked as boolean)}
                        />
                        <Label htmlFor={`priority-${priority}`} className="text-sm capitalize">
                          {priority}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Department</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2 max-h-32 overflow-y-auto">
                    {departments.map((department) => (
                      <div key={department} className="flex items-center space-x-2">
                        <Checkbox
                          id={`dept-${department}`}
                          checked={filters.department.includes(department)}
                          onCheckedChange={(checked) => handleDepartmentChange(department, checked as boolean)}
                        />
                        <Label htmlFor={`dept-${department}`} className="text-sm">
                          {department}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date Range
                  </Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label htmlFor="start-date" className="text-xs text-muted-foreground">
                        Start Date
                      </Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={filters.dateRange?.start || ""}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            dateRange: {
                              start: e.target.value,
                              end: prev.dateRange?.end || "",
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date" className="text-xs text-muted-foreground">
                        End Date
                      </Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={filters.dateRange?.end || ""}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            dateRange: {
                              start: prev.dateRange?.start || "",
                              end: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Report Options
              </h3>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-metrics"
                    checked={options.includeMetrics}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, includeMetrics: checked as boolean }))
                    }
                  />
                  <Label htmlFor="include-metrics" className="text-sm">
                    Include metrics and statistics
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-comments"
                    checked={options.includeComments}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, includeComments: checked as boolean }))
                    }
                  />
                  <Label htmlFor="include-comments" className="text-sm">
                    Include ticket comments
                  </Label>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Report Preview</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Total tickets in database: {ticketCount}</p>
                  <p>Worksheets to include:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Audit Tickets (main data)</li>
                    {options.includeMetrics && <li>Metrics & Statistics</li>}
                    {options.includeComments && <li>Comments</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={generateReport} disabled={loading} className="flex items-center gap-2">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate Excel Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
