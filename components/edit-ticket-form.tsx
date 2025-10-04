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
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { translateDepartment } from "@/lib/ticket-utils"

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
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
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
            {t("tickets.backToTicket")}
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t("tickets.editTicketTitle")}</h1>
          <p className="text-muted-foreground font-mono">{ticket.ticket_number}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("tickets.ticketDetailsCard")}</CardTitle>
          <CardDescription>{t("tickets.updateTicketInfo")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title">{t("tickets.title")}</Label>
              <Input
                id="title"
                value={ticket.title || ""}
                onChange={(e) => setTicket({ ...ticket, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">{t("tickets.department")}</Label>
              <Select
                value={ticket.department || "General"}
                onValueChange={(value) => setTicket({ ...ticket, department: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IT">{t("tickets.deptIT")}</SelectItem>
                  <SelectItem value="Finance">{t("tickets.deptFinance")}</SelectItem>
                  <SelectItem value="HR">{t("tickets.deptHR")}</SelectItem>
                  <SelectItem value="Operations">{t("tickets.deptOperations")}</SelectItem>
                  <SelectItem value="Legal">{t("tickets.deptLegal")}</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="General">{t("tickets.deptGeneral")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to" className="flex items-center gap-2">
                {t("tickets.assignedTo")}
                {loadingUsers ? (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({t("tickets.loading")})
                  </span>
                ) : availableUsers.length > 0 ? (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({availableUsers.length} {t("tickets.available")})
                  </span>
                ) : null}
              </Label>
              <Select
                value={ticket.assigned_to || "unassigned"}
                onValueChange={(value) => setTicket({ ...ticket, assigned_to: value === "unassigned" ? null : value })}
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? t("tickets.loadingUsers") : t("tickets.selectUser")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {t("tickets.unassigned")}
                    </div>
                  </SelectItem>
                  {availableUsers.length === 0 && ticket.department !== "General" && !loadingUsers && (
                    <SelectItem value="no-users" disabled>
                      {t("tickets.noUsersInDepartment")}
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
                  {t("tickets.noUsersFound", { department: translateDepartment(ticket.department, t) })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">{t("tickets.priority")}</Label>
              <Select
                value={ticket.priority || "medium"}
                onValueChange={(value) => setTicket({ ...ticket, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("tickets.priorityLow")}</SelectItem>
                  <SelectItem value="medium">{t("tickets.priorityMedium")}</SelectItem>
                  <SelectItem value="high">{t("tickets.priorityHigh")}</SelectItem>
                  <SelectItem value="critical">{t("tickets.priorityCritical")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t("tickets.status")}</Label>
              <Select
                value={ticket.status || "open"}
                onValueChange={(value) => setTicket({ ...ticket, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{t("tickets.statusOpen")}</SelectItem>
                  <SelectItem value="in_progress">{t("tickets.statusInProgress")}</SelectItem>
                  <SelectItem value="resolved">{t("tickets.statusResolved")}</SelectItem>
                  <SelectItem value="closed">{t("tickets.statusClosed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="due_date">{t("tickets.dueDate")}</Label>
              <Input
                id="due_date"
                type="date"
                value={ticket.due_date ? ticket.due_date.split("T")[0] : ""}
                onChange={(e) => setTicket({ ...ticket, due_date: e.target.value || null })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("tickets.description")}</Label>
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
                    {t("tickets.saving")}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t("tickets.saveChanges")}
                  </>
                )}
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/tickets/${ticket.id}`}>{t("common.cancel")}</Link>
              </Button>
            </div>

            <form action={deleteTicket.bind(null, ticket.id)}>
              <Button
                type="submit"
                variant="destructive"
                disabled={saving}
                onClick={(e) => {
                  console.log('🖱️ Delete button clicked for ticket:', ticket.id)
                  if (!confirm(t("tickets.deleteTicketConfirm"))) {
                    console.log('❌ User cancelled deletion')
                    e.preventDefault()
                  } else {
                    console.log('✅ User confirmed deletion, submitting form...')
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("tickets.deleteTicketButton")}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}