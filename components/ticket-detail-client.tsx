"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Calendar,
  User,
  Clock,
  Edit,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Send,
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

interface TicketDetailClientProps {
  ticket: Ticket
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

export function TicketDetailClient({ ticket }: TicketDetailClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Get success/error messages from URL
  const successMessage = searchParams.get('success')
  const errorMessage = searchParams.get('error')

  const updateTicketStatus = async (newStatus: string) => {
    setStatusUpdating(true)
    try {
      const result = await updateTicketStatusAction(ticket.id, newStatus)
      if (result?.error) {
        console.error("Error updating status:", result.error)
      } else {
        console.log("Status updated successfully")
        router.refresh()
      }
    } catch (error) {
      console.error("Error updating ticket status:", error)
    } finally {
      setStatusUpdating(false)
    }
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

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Ticket Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Add Comment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Add Comment</CardTitle>
              <CardDescription>
                Share updates, ask questions, or provide additional information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={addComment.bind(null, ticket.id)} className="space-y-4">
                <Textarea
                  name="content"
                  placeholder="Write your comment here..."
                  className="min-h-[100px]"
                  required
                />
                <div className="flex justify-end">
                  <CommentSubmitButton />
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status and Priority */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Select
                    value={ticket.status}
                    onValueChange={updateTicketStatus}
                    disabled={statusUpdating}
                  >
                    <SelectTrigger>
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
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Priority</label>
                <div className="mt-1">
                  <Badge className={priorityColors[ticket.priority as keyof typeof priorityColors]}>
                    {ticket.priority}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Department</label>
                <p className="text-sm">{ticket.department}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(ticket.created_at), "MMM d, yyyy")}
                </div>
              </div>

              {ticket.due_date && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    {format(new Date(ticket.due_date), "MMM d, yyyy")}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Assigned To</label>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  {ticket.assigned_profile?.full_name || "Unassigned"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}