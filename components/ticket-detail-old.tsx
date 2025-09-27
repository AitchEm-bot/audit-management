"use client"

import { useState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Calendar,
  User,
  Clock,
  MessageSquare,
  Edit,
  ArrowLeft,
  GitCommit,
  CheckCircle,
  AlertCircle,
  FileIcon,
  Upload,
  Send,
  Activity
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { addComment, updateTicketStatus as updateTicketStatusAction } from "@/app/tickets/[id]/actions"

interface Ticket {
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
  profiles: {
    full_name: string
    email: string
  } | null
  assigned_profile: {
    full_name: string
    email: string
  } | null
}

interface TicketActivity {
  id: string
  activity_type: string
  content: string
  old_value: string | null
  new_value: string | null
  metadata: any
  created_at: string
  user_id: string
  profiles: {
    full_name: string
    email: string
  }
  attachments?: TicketAttachment[]
}

interface TicketAttachment {
  id: string
  filename: string
  file_path: string
  file_size: number
  mime_type: string
  created_at: string
}

interface TicketDetailProps {
  ticketId: string
  initialTicket?: Ticket
}

const priorityColors = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
}

const statusColors = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
}

function CommentSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      className="flex items-center gap-2"
      disabled={pending}
    >
      <Send className="h-4 w-4" />
      {pending ? "Posting..." : "Comment"}
    </Button>
  )
}

export function TicketDetail({ ticketId, initialTicket }: TicketDetailProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [ticket, setTicket] = useState<Ticket | null>(initialTicket || null)
  const [activities, setActivities] = useState<TicketActivity[]>([])
  const [loading, setLoading] = useState(!initialTicket)

  // Get success/error messages from URL params
  const successMessage = searchParams.get('success')
  const errorMessage = searchParams.get('error')
  const refreshParam = searchParams.get('refresh')

  useEffect(() => {
    if (!initialTicket) {
      fetchTicket()
    } else {
      // We have initial ticket data, so go directly to activities
      console.log("Using initial ticket data:", initialTicket.title)
      fetchActivities()
    }
  }, [ticketId])

  useEffect(() => {
    if (ticket && !initialTicket) {
      // Only fetch activities if we fetched the ticket client-side
      fetchActivities()
    }
  }, [ticket])

  // Force refresh activities when refresh param changes
  useEffect(() => {
    if (refreshParam) {
      console.log("Refresh parameter detected, refetching activities...")
      fetchActivities()
    }
  }, [refreshParam])

  const fetchTicket = async () => {
    const supabase = createClient()
    console.log("Fetching ticket with ID:", ticketId)

    try {
      // Add a timeout to prevent hanging requests
      const fetchPromise = supabase
        .from("audit_tickets")
        .select(`
          *,
          profiles:created_by (full_name, email),
          assigned_profile:assigned_to (full_name, email)
        `)
        .eq("id", ticketId)
        .single()

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), 10000)
      )

      const result = await Promise.race([fetchPromise, timeoutPromise])
      const { data, error } = result as any

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      console.log("Ticket fetched successfully:", data)
      setTicket(data)
    } catch (error) {
      console.error("Error fetching ticket:", error)
      // Set a minimal ticket object to prevent infinite loading
      const fallbackTicket = {
        id: ticketId,
        ticket_number: `TICKET-${ticketId.slice(0, 8)}`,
        title: "Ticket Details",
        description: "This ticket exists but detailed information is currently unavailable.",
        department: "General",
        priority: "medium" as const,
        status: "open" as const,
        due_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: "system",
        assigned_to: null,
        profiles: { full_name: "System", email: "" },
        assigned_profile: null
      }
      console.log("Setting fallback ticket:", fallbackTicket)
      setTicket(fallbackTicket)
    } finally {
      console.log("Setting loading to false")
      setLoading(false)
    }
  }

  const fetchActivities = async () => {
    console.log("🔍 fetchActivities called for ticket:", ticketId)
    const supabase = createClient()

    try {
      console.log("📡 Attempting to fetch from ticket_activities table...")
      // Simple query without joins - just get the basic activity data
      const { data, error } = await supabase
        .from("ticket_activities")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("❌ Activities table query error:", error)
        console.error("Error details:", error.code, error.message)
        // Create a fallback "ticket created" activity using ticket data
        console.log("🔄 Creating fallback activities due to error")
        createFallbackActivities()
      } else {
        console.log("✅ Successfully fetched activities:", data?.length || 0)
        console.log("📋 Activities data:", data)
        // Transform the data to include basic profile info
        const activitiesWithProfiles = data?.map(activity => ({
          ...activity,
          profiles: { full_name: 'User', email: '' }, // Simple fallback
          attachments: [] // Simple fallback
        })) || []
        setActivities(activitiesWithProfiles)
      }
    } catch (error) {
      console.error("💥 Unexpected error fetching activities:", error)
      createFallbackActivities()
    }
  }

  const createFallbackActivities = () => {
    if (!ticket) return

    const fallbackActivities: TicketActivity[] = [
      {
        id: 'fallback-created',
        activity_type: 'ticket_created',
        content: 'Ticket created',
        old_value: null,
        new_value: ticket.status,
        metadata: null,
        created_at: ticket.created_at,
        user_id: ticket.created_by,
        profiles: ticket.profiles || { full_name: 'Unknown User', email: '' },
        attachments: []
      }
    ]

    setActivities(fallbackActivities)
  }


  const updateTicketStatus = async (newStatus: string) => {
    const supabase = createClient()

    try {
      const oldStatus = ticket?.status
      const { error } = await supabase.from("audit_tickets").update({ status: newStatus }).eq("id", ticketId)

      if (error) throw error

      fetchTicket() // Refresh ticket data

      // Try to add status change activity, but handle gracefully if table doesn't exist
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from("ticket_activities").insert({
            ticket_id: ticketId,
            user_id: user.id,
            activity_type: "status_change",
            content: `Status changed from ${oldStatus} to ${newStatus}`,
            old_value: oldStatus,
            new_value: newStatus,
          })
        }
        fetchActivities() // Refresh activities to see status change
      } catch (activityError) {
        console.error("Could not log status change activity:", activityError)
        // Add synthetic activity to current state
        if (oldStatus && ticket) {
          const statusActivity: TicketActivity = {
            id: `fallback-status-${Date.now()}`,
            activity_type: 'status_change',
            content: `Status changed from ${oldStatus} to ${newStatus}`,
            old_value: oldStatus,
            new_value: newStatus,
            metadata: null,
            created_at: new Date().toISOString(),
            user_id: ticket.created_by,
            profiles: { full_name: 'You', email: '' },
            attachments: []
          }
          setActivities(prev => [...prev, statusActivity])
        }
      }
    } catch (error) {
      console.error("Error updating ticket status:", error)
    }
  }

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case "ticket_created":
        return <AlertCircle className="h-4 w-4 text-blue-600" />
      case "status_change":
        return <GitCommit className="h-4 w-4 text-purple-600" />
      case "assignment_change":
        return <User className="h-4 w-4 text-orange-600" />
      case "comment":
        return <MessageSquare className="h-4 w-4 text-gray-600" />
      case "file_attachment":
        return <FileIcon className="h-4 w-4 text-green-600" />
      case "priority_change":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "due_date_change":
        return <Calendar className="h-4 w-4 text-blue-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (loading) {
    console.log("Component is in loading state")
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading ticket details...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!ticket) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Ticket not found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{ticket.title}</h1>
          <p className="text-muted-foreground font-mono">{ticket.ticket_number}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/tickets/${ticket.id}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Main ticket info card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getActivityIcon("ticket_created")}
              <div>
                <p className="font-medium">
                  {ticket.profiles?.full_name || "Unknown"} opened this ticket
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(ticket.created_at), "MMM dd, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge className={statusColors[ticket.status as keyof typeof statusColors]}>
                {ticket.status.replace("_", " ")}
              </Badge>
              <Badge className={priorityColors[ticket.priority as keyof typeof priorityColors]}>
                {ticket.priority}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            <p className="text-sm whitespace-pre-wrap text-foreground">{ticket.description}</p>
          </div>

          <Separator className="my-4" />

          {/* Metadata in a compact grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Status: </span>
              <Select value={ticket.status} onValueChange={updateTicketStatus}>
                <SelectTrigger className="h-6 w-auto inline-flex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Department: </span>
              <span>{ticket.department}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Assigned: </span>
              <span>{ticket.assigned_profile?.full_name || "Unassigned"}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Due: </span>
              <span>
                {ticket.due_date ? format(new Date(ticket.due_date), "MMM dd") : "No due date"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GitHub-style Timeline */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Timeline ({activities.length})
        </h3>

        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No activity yet. Status changes and comments will appear here.
            </div>
          ) : (
            activities.map((activity, index) => (
              <div key={activity.id} className="flex gap-3">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full border-2 border-muted bg-background flex items-center justify-center">
                    {getActivityIcon(activity.activity_type)}
                  </div>
                  {index < activities.length - 1 && (
                    <div className="w-0.5 h-6 bg-border mt-2"></div>
                  )}
                </div>

                {/* Activity content */}
                <div className="flex-1 min-w-0">
                  <div className="bg-muted/30 border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {activity.profiles?.full_name || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {activity.activity_type.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(activity.created_at), "MMM dd, yyyy 'at' h:mm a")}
                      </span>
                    </div>

                    {/* Activity content based on type */}
                    {activity.activity_type === "comment" && (
                      <div className="space-y-2">
                        <p className="text-sm whitespace-pre-wrap">{activity.content}</p>
                        {activity.attachments && activity.attachments.length > 0 && (
                          <div className="border-t pt-2">
                            <p className="text-xs text-muted-foreground mb-1">Attachments:</p>
                            <div className="space-y-1">
                              {activity.attachments.map((attachment) => (
                                <div
                                  key={attachment.id}
                                  className="flex items-center gap-2 text-xs p-2 bg-muted rounded"
                                >
                                  <FileIcon className="h-3 w-3" />
                                  <span>{attachment.filename}</span>
                                  <span className="text-muted-foreground">
                                    ({formatFileSize(attachment.file_size)})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activity.activity_type === "status_change" && (
                      <p className="text-sm">
                        Changed status from{" "}
                        <Badge variant="outline" className="text-xs">
                          {activity.old_value}
                        </Badge>{" "}
                        to{" "}
                        <Badge variant="outline" className="text-xs">
                          {activity.new_value}
                        </Badge>
                      </p>
                    )}

                    {activity.activity_type === "assignment_change" && (
                      <p className="text-sm">{activity.content}</p>
                    )}

                    {activity.activity_type === "ticket_created" && (
                      <p className="text-sm">Created this ticket</p>
                    )}

                    {activity.activity_type === "priority_change" && (
                      <p className="text-sm">
                        Changed priority from{" "}
                        <Badge variant="outline" className="text-xs">
                          {activity.old_value}
                        </Badge>{" "}
                        to{" "}
                        <Badge variant="outline" className="text-xs">
                          {activity.new_value}
                        </Badge>
                      </p>
                    )}

                    {activity.activity_type === "due_date_change" && (
                      <p className="text-sm">{activity.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add comment form */}
        <Card>
          <CardContent className="p-4">
            <form action={addComment.bind(null, ticketId)} className="space-y-3">
              <Textarea
                name="content"
                placeholder="Leave a comment..."
                rows={3}
                className="resize-none"
                required
              />

              {/* File upload (for future implementation) */}
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  name="files"
                  multiple
                  className="file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-muted file:text-muted-foreground"
                  disabled
                />
                <span className="text-xs text-muted-foreground">
                  File uploads coming soon
                </span>
              </div>

              <div className="flex justify-end">
                <CommentSubmitButton />
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
