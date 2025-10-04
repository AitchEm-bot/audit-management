"use client"

import { useState, useEffect, useMemo, useRef } from "react"
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
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { translateDepartment } from "@/lib/ticket-utils"
import { DatePicker } from "@/components/ui/date-picker"

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
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const isRTL = locale === "ar"
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [ticketCount, setTicketCount] = useState(0)

  // Memoize queries instance with error handling
  const queries = useMemo(() => {
    try {
      const supabase = createClient()
      return createSupabaseQueries(supabase)
    } catch (error) {
      console.error("Failed to create Supabase client for reports:", error)
      return null
    }
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
      console.log("ReportGenerator: Starting initial data fetch...")

      // Try client-side queries with timeout, but don't fail if they don't work
      let departmentsData: string[] = []
      let totalTicketCount = 0

      if (queries) {
        try {
          console.log("ReportGenerator: Attempting client-side queries...")

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Client-side query timeout")), 5000)
          )

          const [departmentsResult, statsResult] = await Promise.race([
            Promise.all([
              queries.getDepartments(),
              queries.getDashboardStats()
            ]),
            timeoutPromise
          ]) as any

          console.log("ReportGenerator: Client-side queries succeeded")

          if (departmentsResult.data) {
            departmentsData = departmentsResult.data
            console.log("ReportGenerator: Departments loaded:", departmentsData.length)
          }

          if (statsResult.data) {
            totalTicketCount = statsResult.data.total || 0
            console.log("ReportGenerator: Ticket count:", totalTicketCount)
          }
        } catch (clientError) {
          console.warn("ReportGenerator: Client-side queries failed, using defaults:", clientError)
          // Don't throw error, just use defaults
        }
      } else {
        console.warn("ReportGenerator: Supabase client not available, using defaults")
      }

      // Set the data (either from queries or defaults)
      setDepartments(departmentsData)
      setTicketCount(totalTicketCount)

      console.log("ReportGenerator: Initial data fetch completed successfully")
    } catch (error) {
      console.error("ReportGenerator: Error in initial data fetch:", error)

      // Set reasonable defaults so the UI still works
      setDepartments([])
      setTicketCount(0)

      // Don't show error for initial data fetch failures since report generation will work server-side
      console.log("ReportGenerator: Using default values due to initial data fetch failure")
    }
  }

  const generateReport = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log("generateReport: Starting server-side report generation...")

      // Prepare request payload - only include filters that have values
      const requestFilters: any = {}

      if (filters.status.length > 0) {
        requestFilters.status = filters.status
      }

      if (filters.priority.length > 0) {
        requestFilters.priority = filters.priority
      }

      if (filters.department.length > 0) {
        requestFilters.department = filters.department
      }

      if (filters.dateRange) {
        requestFilters.dateRange = filters.dateRange
      }

      const requestPayload = {
        filters: requestFilters,
        options: {
          includeComments: options.includeComments,
          includeMetrics: options.includeMetrics,
        }
      }

      console.log("generateReport: Request payload:", requestPayload)

      // Make server-side request
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })

      console.log("generateReport: Server response status:", response.status)

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to generate report'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          console.warn("Failed to parse error response:", e)
        }
        throw new Error(errorMessage)
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition')
      let filename = `audit-report_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }

      console.log("generateReport: Downloading file:", filename)

      // Get the blob data and trigger download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      console.log("generateReport: Download completed successfully")

      // Show success message
      const successMessage = `Report generated successfully! Downloaded ${filename}.`
      setSuccess(successMessage)

      console.log("generateReport: About to clear loading state")

    } catch (err) {
      console.error("generateReport: Error occurred:", err)

      // Provide user-friendly error messages based on error type
      let errorMessage = "An unexpected error occurred while generating the report."

      if (err instanceof Error) {
        if (err.message.includes("timeout") || err.message.includes("timed out")) {
          errorMessage = "The report generation timed out. This usually happens with large datasets. Please try using more specific filters (date range, department, status) to reduce the data size."
        } else if (err.message.includes("network") || err.message.includes("fetch")) {
          errorMessage = "Network connection issue. Please check your internet connection and try again."
        } else if (err.message.includes("permission") || err.message.includes("unauthorized") || err.message.includes("Unauthorized")) {
          errorMessage = "You don't have permission to access this data. Please contact your administrator."
        } else if (err.message.includes("No tickets found")) {
          errorMessage = err.message // Use the specific "no tickets found" message
        } else {
          errorMessage = `Report generation failed: ${err.message}`
        }
      }

      setError(errorMessage)
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
            {t("reports.generateAuditReport")}
          </CardTitle>
          <CardDescription>
            {t("reports.exportAuditTickets")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Filters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {t("reports.filters")}
                </h3>
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    {t("reports.clearAll")}
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">{t("reports.statusFilter")}</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {["open", "in_progress", "resolved", "closed"].map((status) => {
                      const statusKey = status === "in_progress" ? "statusInProgress" : `status${status.charAt(0).toUpperCase() + status.slice(1)}`
                      return (
                        <div key={status} className={`flex items-center gap-2`}>
                          <Checkbox
                            id={`status-${status}`}
                            checked={filters.status.includes(status)}
                            onCheckedChange={(checked) => handleStatusChange(status, checked as boolean)}
                          />
                          <Label htmlFor={`status-${status}`} className="text-sm">
                            {t(`tickets.${statusKey}`)}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">{t("reports.priorityFilter")}</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {["low", "medium", "high", "critical"].map((priority) => (
                      <div key={priority} className={`flex items-center gap-2`}>
                        <Checkbox
                          id={`priority-${priority}`}
                          checked={filters.priority.includes(priority)}
                          onCheckedChange={(checked) => handlePriorityChange(priority, checked as boolean)}
                        />
                        <Label htmlFor={`priority-${priority}`} className="text-sm">
                          {t(`tickets.priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">{t("reports.departmentFilter")}</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2 max-h-32 overflow-y-auto">
                    {departments.map((department) => (
                      <div key={department} className={`flex items-center gap-2`}>
                        <Checkbox
                          id={`dept-${department}`}
                          checked={filters.department.includes(department)}
                          onCheckedChange={(checked) => handleDepartmentChange(department, checked as boolean)}
                        />
                        <Label htmlFor={`dept-${department}`} className="text-sm">
                          {translateDepartment(department, t)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t("reports.dateRangeFilter")}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label htmlFor="start-date" className="text-xs text-muted-foreground">
                        {t("reports.startDate")}
                      </Label>
                      <DatePicker
                        value={filters.dateRange?.start ? new Date(filters.dateRange.start) : undefined}
                        onChange={(date) =>
                          setFilters((prev) => ({
                            ...prev,
                            dateRange: {
                              start: date ? date.toISOString().split('T')[0] : "",
                              end: prev.dateRange?.end || "",
                            },
                          }))
                        }
                        locale={locale}
                        placeholder={t("reports.startDate")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date" className="text-xs text-muted-foreground">
                        {t("reports.endDate")}
                      </Label>
                      <DatePicker
                        value={filters.dateRange?.end ? new Date(filters.dateRange.end) : undefined}
                        onChange={(date) =>
                          setFilters((prev) => ({
                            ...prev,
                            dateRange: {
                              start: prev.dateRange?.start || "",
                              end: date ? date.toISOString().split('T')[0] : "",
                            },
                          }))
                        }
                        locale={locale}
                        placeholder={t("reports.endDate")}
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
                {t("reports.reportOptions")}
              </h3>

              <div className="space-y-3">
                <div className={`flex items-center gap-2`}>
                  <Checkbox
                    id="include-metrics"
                    checked={options.includeMetrics}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, includeMetrics: checked as boolean }))
                    }
                  />
                  <Label htmlFor="include-metrics" className="text-sm">
                    {t("reports.includeMetrics")}
                  </Label>
                </div>

                <div className={`flex items-center gap-2`}>
                  <Checkbox
                    id="include-comments"
                    checked={options.includeComments}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, includeComments: checked as boolean }))
                    }
                  />
                  <Label htmlFor="include-comments" className="text-sm">
                    {t("reports.includeComments")}
                  </Label>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">{t("reports.reportPreview")}</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{t("reports.totalTicketsInDatabase", { count: ticketCount })}</p>
                  <p>{t("reports.worksheetsToInclude")}</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>{t("reports.auditTicketsSheet")}</li>
                    {options.includeMetrics && <li>{t("reports.metricsSheet")}</li>}
                    {options.includeComments && <li>{t("reports.commentsSheet")}</li>}
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
                  {t("reports.generating")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {t("reports.generateExcelReport")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
