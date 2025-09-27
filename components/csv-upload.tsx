"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import Papa from "papaparse"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, CheckCircle, AlertCircle, Brain, Eye } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface CSVUploadProps {
  onUploadComplete?: (tickets: any[]) => void
}

interface ProcessedTicket {
  title: string
  description: string
  department: string
  priority: string
  status: string
  due_date?: string
  recommendations?: string
  management_response?: string
  risk_level?: string
  finding_status?: string
  responsibility?: string
  followup?: string
  followup_response?: string
  management_updates?: string
}

interface AuditCSVRow {
  seq?: string
  description?: string
  risk?: string
  priority?: string
  recommendations?: string
  management_response?: string
  status?: string
  responsibility?: string
  finding_status?: string
  previous_followup_response?: string
  followup?: string
  followup_response?: string
  followup_management_updates?: string
  [key: string]: string | undefined // Allow for flexible column names
}

interface CSVParseResult {
  data: AuditCSVRow[]
  errors: Papa.ParseError[]
  meta: Papa.ParseMeta
}

export function CSVUpload({ onUploadComplete }: CSVUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [processedTickets, setProcessedTickets] = useState<ProcessedTicket[]>([])
  const [parsedCSVData, setParsedCSVData] = useState<AuditCSVRow[]>([])
  const [csvErrors, setCsvErrors] = useState<Papa.ParseError[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [useAI, setUseAI] = useState(true)

  // Column mapping for different audit report formats
  const COLUMN_MAPPINGS = {
    // Standard variations for common columns
    title: ['title', 'audit_item', 'finding', 'issue', 'seq', 'sequence', 'item'],
    description: ['description', 'finding_description', 'details', 'audit_finding', 'finding_detail'],
    department: ['department', 'responsibility', 'responsible_dept', 'dept', 'responsible_department'],
    priority: ['priority', 'risk', 'severity', 'risk_level'],
    status: ['status', 'finding_status', 'current_status'],
    recommendations: ['recommendations', 'recommendation', 'suggested_action', 'action_required'],
    management_response: ['management_response', 'mgmt_response', 'response', 'management_comment'],
    due_date: ['due_date', 'target_date', 'completion_date', 'deadline']
  }

  const normalizeHeaders = (headers: string[]): string[] => {
    return headers.map(header => {
      const normalized = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')

      // Find the best match for each column
      for (const [standardName, variations] of Object.entries(COLUMN_MAPPINGS)) {
        if (variations.some(variation => normalized.includes(variation.replace(/[^a-z0-9]/g, '_')))) {
          return standardName
        }
      }

      return normalized
    })
  }

  const parseCSVWithPapa = (csvText: string): Promise<CSVParseResult> => {
    return new Promise((resolve, reject) => {
      Papa.parse<AuditCSVRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          // Normalize header names for consistent mapping
          return header.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')
        },
        transform: (value: string, field: string) => {
          // Clean and trim values
          return value.trim()
        },
        complete: (results) => {
          console.log('Papa Parse Results:', {
            dataLength: results.data.length,
            errors: results.errors.length,
            fields: results.meta.fields
          })
          resolve(results as CSVParseResult)
        },
        error: (error: Papa.ParseError) => {
          console.error('Papa Parse Error:', error)
          reject(new Error(`CSV parsing failed: ${error.message}`))
        }
      })
    })
  }

  const convertAuditRowToTicket = (row: AuditCSVRow, index: number): ProcessedTicket => {
    // Extract title from multiple possible fields
    const title = row.title || row.seq || row.description?.substring(0, 50) || `Audit Item ${index + 1}`

    // Extract description from multiple possible fields
    const description = row.description || row.recommendations || row.management_response || ""

    // Extract department from responsibility or department fields (no length limit now)
    const department = row.responsibility || row.department || "General"

    // Map priority/risk to standard priority levels
    const rawPriority = (row.priority || row.risk || "medium").toLowerCase()
    const priority = ["low", "medium", "high", "critical"].includes(rawPriority)
      ? rawPriority
      : "medium"

    // Map status fields
    const rawStatus = (row.status || row.finding_status || "open").toLowerCase()
    const status = ["open", "in_progress", "resolved", "closed"].includes(rawStatus)
      ? rawStatus
      : "open"

    // Format due date to YYYY-MM-DD if provided
    const formatDueDate = (dateStr?: string): string | undefined => {
      if (!dateStr) return undefined

      try {
        // Try parsing various date formats
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return undefined

        // Return in YYYY-MM-DD format for PostgreSQL DATE type
        return date.toISOString().split('T')[0]
      } catch {
        return undefined
      }
    }

    return {
      title: title.substring(0, 500), // Increased from 255 since title is now TEXT
      description,
      department,
      priority: priority as "low" | "medium" | "high" | "critical",
      status: status as "open" | "in_progress" | "resolved" | "closed",
      due_date: formatDueDate(row.due_date),

      // Additional audit-specific fields
      recommendations: row.recommendations || undefined,
      management_response: row.management_response || undefined,
      risk_level: row.risk || undefined,
      finding_status: row.finding_status || undefined,
      responsibility: row.responsibility || undefined,
      followup: row.followup || undefined,
      followup_response: row.followup_response || undefined,
      management_updates: row.followup_management_updates || undefined
    }
  }

  const parseCSV = async (csvText: string): Promise<ProcessedTicket[]> => {
    try {
      // Parse CSV with PapaParse
      const parseResult = await parseCSVWithPapa(csvText)

      // Store parsed data for preview
      setParsedCSVData(parseResult.data)
      setCsvErrors(parseResult.errors)

      // Check for parsing errors
      if (parseResult.errors.length > 0) {
        const criticalErrors = parseResult.errors.filter(error => error.type === 'Delimiter' || error.type === 'Quotes')
        if (criticalErrors.length > 0) {
          throw new Error(`CSV parsing errors: ${criticalErrors.map(e => e.message).join(', ')}`)
        }
      }

      // Validate we have data
      if (!parseResult.data || parseResult.data.length === 0) {
        throw new Error("CSV file appears to be empty or contains no valid data rows")
      }

      // Check for required columns (flexible approach)
      const headers = parseResult.meta.fields || []
      const hasDescription = headers.some(h => COLUMN_MAPPINGS.description.includes(h.toLowerCase()))

      if (!hasDescription) {
        throw new Error("CSV must contain at least a description/finding column")
      }

      // Convert audit rows to processed tickets
      const tickets = parseResult.data.map((row, index) => convertAuditRowToTicket(row, index))

      // Filter out empty/invalid rows with stricter validation
      const validTickets = tickets.filter(ticket => {
        // Must have meaningful title AND description
        const hasValidTitle = ticket.title.trim() !== '' &&
                             ticket.title.trim() !== 'Audit Item' &&
                             !ticket.title.match(/^Audit Item \d+$/)

        const hasValidDescription = ticket.description.trim() !== '' &&
                                   ticket.description.length > 10 // At least 10 characters

        // Must have both title and description with actual content
        return hasValidTitle && hasValidDescription
      })

      if (validTickets.length === 0) {
        throw new Error("No valid audit data found in CSV file")
      }

      console.log(`Successfully parsed ${validTickets.length} valid audit items from CSV (filtered out ${tickets.length - validTickets.length} empty/invalid rows)`)
      return validTickets

    } catch (error) {
      console.error('CSV Parsing Error:', error)
      throw error
    }
  }

  const suggestDepartmentWithKeywords = (title: string, description: string): string => {
    const text = `${title} ${description}`.toLowerCase()

    // Common department keywords from audit reports
    const departmentKeywords = {
      "IT": ["information technology", "software", "system", "database", "network", "cybersecurity", "computer", "digital"],
      "HR": ["human resources", "personnel", "employee", "staff", "hiring", "payroll", "benefits"],
      "Finance": ["financial", "accounting", "budget", "revenue", "expense", "cost", "payment", "procurement"],
      "Legal": ["legal", "compliance", "regulation", "contract", "law", "policy", "governance"],
      "Operations": ["operations", "process", "procedure", "workflow", "efficiency", "performance"],
      "Security": ["security", "access", "control", "risk", "safety", "protection", "breach"],
      "Administration": ["administrative", "management", "oversight", "coordination", "documentation"]
    }

    // Check for keyword matches
    for (const [dept, keywords] of Object.entries(departmentKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return dept
      }
    }

    return "General"
  }

  const suggestDepartmentWithAI = async (title: string, description: string): Promise<string> => {
    try {
      // Validate inputs before sending to API
      if (!title?.trim() || !description?.trim()) {
        console.warn("AI department suggestion skipped: missing title or description")
        return suggestDepartmentWithKeywords(title, description)
      }

      const response = await fetch("/api/suggest-department", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim()
        }),
      })

      if (!response.ok) {
        console.warn(`AI department suggestion API error: ${response.status} ${response.statusText}, falling back to keyword matching`)
        return suggestDepartmentWithKeywords(title, description)
      }

      const data = await response.json()

      // Check if API returned an error
      if (data.error) {
        console.warn("AI department suggestion error:", data.error, "falling back to keyword matching")
        return suggestDepartmentWithKeywords(title, description)
      }

      return data.department || suggestDepartmentWithKeywords(title, description)
    } catch (error) {
      console.error("AI department suggestion failed:", error, "falling back to keyword matching")
      return suggestDepartmentWithKeywords(title, description)
    }
  }

  const processCSVFile = async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setSuccess(null)
    setProgress(0)
    setParsedCSVData([])
    setCsvErrors([])
    setShowPreview(false)

    try {
      console.log(`Processing CSV file: ${file.name} (${file.size} bytes)`)
      const text = await file.text()
      setProgress(10)

      console.log('Parsing CSV with enhanced parser...')
      const tickets = await parseCSV(text)
      setProgress(25)

      console.log(`Parsed ${tickets.length} tickets from CSV`)

      if (useAI) {
        console.log("[v0] Starting AI department assignment for", tickets.length, "tickets")

        try {
          for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i]
            if (!ticket.department || ticket.department === "General") {
              console.log(`Processing ticket ${i + 1}/${tickets.length}: ${ticket.title}`)

              // Add timeout to prevent hanging
              const timeoutPromise = new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 10000) // 10 second timeout
              )

              const departmentPromise = suggestDepartmentWithAI(ticket.title, ticket.description)

              try {
                const suggestedDepartment = await Promise.race([departmentPromise, timeoutPromise])
                ticket.department = suggestedDepartment
                console.log(`[v0] AI suggested department "${suggestedDepartment}" for ticket: ${ticket.title.substring(0, 50)}`)
              } catch (timeoutError) {
                console.warn(`Timeout for ticket ${i + 1}, using keyword fallback`)
                ticket.department = suggestDepartmentWithKeywords(ticket.title, ticket.description)
              }
            }
            setProgress(25 + ((i + 1) / tickets.length) * 25) // Progress from 25% to 50%
          }
        } catch (error) {
          console.error("AI processing failed, continuing with existing departments:", error)
        }
      }

      setProcessedTickets(tickets)
      setShowPreview(true)
      setProgress(50)

      console.log("Using server-side ticket insertion API...")

      // Prepare tickets data for server-side insertion
      const ticketsToInsert = tickets.map((ticket) => ({
        title: ticket.title,
        description: ticket.description,
        department: ticket.department,
        priority: ticket.priority,
        status: ticket.status,
        due_date: ticket.due_date,
        // Note: Server will add ticket_number and created_by
      }))

      console.log("Tickets prepared for server-side insertion:", {
        totalTickets: ticketsToInsert.length,
        sampleTicket: ticketsToInsert[0]
      })

      setProgress(75)

      // Call server-side API for ticket insertion
      console.log("Calling server-side upload API...")

      const uploadResponse = await fetch("/api/upload-tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tickets: ticketsToInsert }),
      })

      console.log("Server API response status:", uploadResponse.status)

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        console.error("Server-side upload failed:", errorData)
        throw new Error(`Upload failed: ${errorData.error} - ${errorData.details || ""}`)
      }

      const result = await uploadResponse.json()
      console.log("Server-side upload successful:", result)

      const data = result.tickets

      setProgress(100)
      setSuccess(`Successfully created ${data.length} audit tickets${useAI ? " with AI department assignments" : ""}`)
      onUploadComplete?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred processing the file")
    } finally {
      setIsProcessing(false)
    }
  }

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        processCSVFile(file)
      }
    },
    [useAI],
  ) // Added useAI dependency

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    maxFiles: 1,
    disabled: isProcessing,
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Audit CSV
          </CardTitle>
          <CardDescription>
            Upload a CSV file to automatically create audit tickets. Required columns: title, description
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Switch id="use-ai" checked={useAI} onCheckedChange={setUseAI} disabled={isProcessing} />
            <Label htmlFor="use-ai" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Use AI for department assignment
            </Label>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} />
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg">Drop the CSV file here...</p>
            ) : (
              <div>
                <p className="text-lg mb-2">Drag & drop a CSV file here, or click to select</p>
                <p className="text-sm text-muted-foreground">
                  Supports .csv files with columns: title, description, department, priority, status, due_date
                </p>
                {useAI && (
                  <p className="text-sm text-blue-600 mt-2">
                    AI will automatically suggest departments for tickets without department assignments
                  </p>
                )}
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {progress < 25 && "Reading CSV file..."}
                  {progress >= 25 && progress < 50 && useAI && "AI analyzing departments..."}
                  {progress >= 25 && progress < 50 && !useAI && "Processing tickets..."}
                  {progress >= 50 && progress < 75 && "Preparing database..."}
                  {progress >= 75 && "Creating tickets..."}
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {error && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {showPreview && parsedCSVData.length > 0 && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">CSV Parse Preview</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showPreview ? "Hide" : "Show"} Raw Data
                </Button>
              </div>

              {csvErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Found {csvErrors.length} parsing warnings. Data may be incomplete.
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-60 overflow-auto border rounded p-4 bg-muted/30">
                <div className="text-sm font-mono">
                  <div className="font-semibold mb-2">Parsed {parsedCSVData.length} rows from CSV:</div>
                  {parsedCSVData.slice(0, 3).map((row, index) => (
                    <div key={index} className="mb-4 p-2 bg-background rounded border">
                      <div className="font-medium">Row {index + 1}:</div>
                      {Object.entries(row).map(([key, value]) => (
                        value && (
                          <div key={key} className="ml-2">
                            <span className="text-blue-600">{key}:</span> {String(value).substring(0, 100)}
                            {String(value).length > 100 && "..."}
                          </div>
                        )
                      ))}
                    </div>
                  ))}
                  {parsedCSVData.length > 3 && (
                    <div className="text-muted-foreground">...and {parsedCSVData.length - 3} more rows</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {processedTickets.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Preview of processed tickets:</h4>
              <div className="max-h-40 overflow-y-auto border rounded p-2 text-sm">
                {processedTickets.slice(0, 5).map((ticket, index) => (
                  <div key={index} className="py-1 border-b last:border-b-0">
                    <strong>{ticket.title}</strong> - {ticket.department} ({ticket.priority})
                    {useAI && <span className="text-blue-600 ml-2">🤖</span>}
                  </div>
                ))}
                {processedTickets.length > 5 && (
                  <div className="py-1 text-muted-foreground">...and {processedTickets.length - 5} more tickets</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enhanced CSV Format Guide</CardTitle>
          <CardDescription>Supports standard audit reports with flexible column mapping</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium mb-2">
                <strong>Flexible Column Recognition:</strong>
              </p>
              <p className="text-muted-foreground mb-3">
                The parser automatically recognizes common audit report column variations and maps them appropriately.
              </p>
            </div>

            <div>
              <p className="font-medium mb-2">
                <strong>Supported Column Variations:</strong>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Title/Finding:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li><code>title, audit_item, finding, issue, seq, sequence</code></li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Description:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li><code>description, finding_description, details, audit_finding</code></li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Department/Responsibility:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li><code>department, responsibility, responsible_dept, dept</code></li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Priority/Risk:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li><code>priority, risk, severity, risk_level</code></li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Status:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li><code>status, finding_status, current_status</code></li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Recommendations:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li><code>recommendations, recommendation, suggested_action</code></li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Management Response:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li><code>management_response, mgmt_response, response</code></li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Follow-up:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li><code>followup, followup_response, followup_management_updates</code></li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <p className="font-medium mb-2">
                <strong>Advanced Features:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Handles quoted fields with commas, newlines, and special characters</li>
                <li>Automatic column header normalization and mapping</li>
                <li>Supports both governmental audit reports and internal tracking formats</li>
                <li>AI-powered department assignment for unmapped entries</li>
                <li>Real-time parsing preview with error detection</li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-2">
                <strong>Data Requirements:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><strong>Minimum:</strong> At least one description/finding column</li>
                <li><strong>Recommended:</strong> Include title, description, and responsibility columns</li>
                <li><strong>Optional:</strong> Priority, status, due dates, management responses</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
