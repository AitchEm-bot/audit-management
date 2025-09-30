"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { deleteTicket, updateTicket } from "@/app/tickets/[id]/edit/actions"
import { Save, ArrowLeft, Trash2, User, Users } from "lucide-react"
import Link from "next/link"
import { CloseTicketDialog } from "@/components/close-ticket-dialog"

interface Ticket {
  id: string
  ticket_number: string
  title: string
  description: string
  department: string
  priority: string
  status: string
  due_date: string | null
  assigned_to: string | null
}

interface UserProfile {
  id: string
  full_name: string
  email: string
}

interface EditTicketFormProps {
  ticket: Ticket
  availableUsers?: UserProfile[]
  commentCount?: number
}

export function EditTicketForm({
  ticket: initialTicket,
  availableUsers: initialAvailableUsers = [],
  commentCount: initialCommentCount = 0
}: EditTicketFormProps) {
  const [ticket, setTicket] = useState<Ticket>(initialTicket)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>(initialAvailableUsers)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const router = useRouter()

  // Update available users when props change
  useEffect(() => {
    setAvailableUsers(initialAvailableUsers)
  }, [initialAvailableUsers])

  // Update comment count when props change
  useEffect(() => {
    setCommentCount(initialCommentCount)
  }, [initialCommentCount])

  // Fetch users when department changes
  useEffect(() => {
    const fetchUsersForDepartment = async () => {
      if (!ticket.department || ticket.department === "General") {
        setAvailableUsers([])
        return
      }

      setLoadingUsers(true)
      try {
        const response = await fetch(`/api/users?department=${encodeURIComponent(ticket.department)}`)

        if (!response.ok) {
          console.error("Error fetching users:", response.statusText)
          setAvailableUsers([])
        } else {
          const users = await response.json()
          setAvailableUsers(users || [])

          // Check if currently assigned user is in the new department
          if (ticket.assigned_to) {
            const assignedUserInDepartment = users?.find(
              (u: UserProfile) => u.id === ticket.assigned_to
            )
            if (!assignedUserInDepartment) {
              // Clear assignment if user not in new department
              setTicket({ ...ticket, assigned_to: null })
            }
          }
        }
      } catch (error) {
        console.error("Error fetching users:", error)
        setAvailableUsers([])
      } finally {
        setLoadingUsers(false)
      }
    }

    fetchUsersForDepartment()
  }, [ticket.department])

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const result = await updateTicket(ticket.id, {
        title: ticket.title,
        description: ticket.description,
        department: ticket.department,
        priority: ticket.priority,
        status: ticket.status,
        due_date: ticket.due_date,
        assigned_to: ticket.assigned_to,
      })

      if (result?.requiresCloseDialog) {
        // Show the close dialog instead of saving directly
        setSaving(false)
        setShowCloseDialog(true)
        return
      }

      if (result?.error) {
        setError(result.error)
        return
      }

      // Success - redirect to ticket page
      router.push(`/tickets/${ticket.id}?success=Ticket updated successfully`)
      router.refresh()
    } catch (error) {
      console.error("Error saving ticket:", error)
      setError("Failed to save ticket. Please try again.")
    } finally {
      setSaving(false)
    }
  }


  return (
    <div className="space-y-6">
      {/* Close Ticket Dialog */}
      <CloseTicketDialog
        open={showCloseDialog}
        onOpenChange={(open) => {
          setShowCloseDialog(open)
          // If dialog is closed without saving, revert status back
          if (!open && ticket.status === "closed") {
            router.push(`/tickets/${ticket.id}`)
          }
        }}
        ticketId={ticket.id}
        commentCount={commentCount}
      />

      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href={`/tickets/${ticket.id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Ticket
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Ticket</h1>
          <p className="text-muted-foreground font-mono">{ticket.ticket_number}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ticket Details</CardTitle>
          <CardDescription>Update the ticket information below</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={ticket.title || ""}
                onChange={(e) => setTicket({ ...ticket, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={ticket.department || "General"}
                onValueChange={(value) => setTicket({ ...ticket, department: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to" className="flex items-center gap-2">
                Assigned To
                {loadingUsers ? (
                  <span className="text-xs text-muted-foreground font-normal">
                    (loading...)
                  </span>
                ) : availableUsers.length > 0 ? (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({availableUsers.length} available)
                  </span>
                ) : null}
              </Label>
              <Select
                value={ticket.assigned_to || "unassigned"}
                onValueChange={(value) => setTicket({ ...ticket, assigned_to: value === "unassigned" ? null : value })}
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select user"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Unassigned
                    </div>
                  </SelectItem>
                  {availableUsers.length === 0 && ticket.department !== "General" && !loadingUsers && (
                    <SelectItem value="no-users" disabled>
                      No users in this department
                    </SelectItem>
                  )}
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {user.full_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ticket.department !== "General" && availableUsers.length === 0 && !loadingUsers && (
                <p className="text-xs text-muted-foreground">
                  No users found in the {ticket.department} department
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={ticket.priority || "medium"}
                onValueChange={(value) => setTicket({ ...ticket, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={ticket.status || "open"}
                onValueChange={(value) => setTicket({ ...ticket, status: value })}
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

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={ticket.due_date ? ticket.due_date.split("T")[0] : ""}
                onChange={(e) => setTicket({ ...ticket, due_date: e.target.value || null })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={6}
              value={ticket.description || ""}
              onChange={(e) => setTicket({ ...ticket, description: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/tickets/${ticket.id}`}>Cancel</Link>
              </Button>
            </div>

            <form action={deleteTicket.bind(null, ticket.id)}>
              <Button
                type="submit"
                variant="destructive"
                disabled={saving}
                onClick={(e) => {
                  console.log('🖱️ Delete button clicked for ticket:', ticket.id)
                  if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
                    console.log('❌ User cancelled deletion')
                    e.preventDefault()
                  } else {
                    console.log('✅ User confirmed deletion, submitting form...')
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Ticket
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}