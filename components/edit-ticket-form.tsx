"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { deleteTicket } from "@/app/tickets/[id]/edit/actions"
import { Save, ArrowLeft, Trash2, User, Users } from "lucide-react"
import Link from "next/link"

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
}

export function EditTicketForm({ ticket: initialTicket }: EditTicketFormProps) {
  const [ticket, setTicket] = useState<Ticket>(initialTicket)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const router = useRouter()

  // Fetch users by department
  const fetchUsersByDepartment = async (department: string) => {
    if (!department || department === "General") {
      setAvailableUsers([])
      return
    }

    setLoadingUsers(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("department", department)
        .order("full_name", { ascending: true })

      if (error) {
        console.error("Error fetching users:", error)
        setAvailableUsers([])
      } else {
        setAvailableUsers(data || [])
      }
    } catch (error) {
      console.error("Error fetching users:", error)
      setAvailableUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  // Fetch users when component mounts or department changes
  useEffect(() => {
    fetchUsersByDepartment(ticket.department)
  }, [ticket.department])

  const handleSave = async () => {
    const supabase = createClient()
    setSaving(true)
    setError(null)

    try {
      // Get current user for activity logging
      const { data: { user } } = await supabase.auth.getUser()

      // Get current ticket data to check for assignment changes
      const { data: currentTicket } = await supabase
        .from("audit_tickets")
        .select("assigned_to, assigned_profile:assigned_to(full_name)")
        .eq("id", ticket.id)
        .single()

      // Update the ticket
      const { error } = await supabase
        .from("audit_tickets")
        .update({
          title: ticket.title,
          description: ticket.description,
          department: ticket.department,
          priority: ticket.priority,
          status: ticket.status,
          due_date: ticket.due_date,
          assigned_to: ticket.assigned_to,
        })
        .eq("id", ticket.id)

      if (error) throw error

      // Log assignment change activity if assigned_to changed
      if (user && currentTicket && currentTicket.assigned_to !== ticket.assigned_to) {
        const oldAssigned = currentTicket.assigned_profile?.full_name || "Unassigned"
        const newAssignedUser = availableUsers.find(u => u.id === ticket.assigned_to)
        const newAssigned = newAssignedUser?.full_name || "Unassigned"

        try {
          await supabase.from("ticket_activities").insert({
            ticket_id: ticket.id,
            user_id: user.id,
            activity_type: "assignment_change",
            content: `Assignment changed from ${oldAssigned} to ${newAssigned}`,
            old_value: oldAssigned,
            new_value: newAssigned,
          })
        } catch (activityError) {
          console.error("Could not log assignment change:", activityError)
          // Continue even if activity logging fails
        }
      }

      router.push(`/tickets/${ticket.id}`)
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
                {availableUsers.length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({availableUsers.length} available)
                  </span>
                )}
              </Label>
              <Select
                value={ticket.assigned_to || "unassigned"}
                onValueChange={(value) => setTicket({ ...ticket, assigned_to: value === "unassigned" ? null : value })}
                disabled={loadingUsers || (ticket.department !== "General" && availableUsers.length === 0)}
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