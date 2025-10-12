"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, ChevronLeft, ChevronRight, Edit, Eye, User, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { TicketFilters } from "./ticket-filters"
import { TicketPagination } from "./ticket-pagination"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { formatDate } from "@/lib/date-utils"
import { translateStatus, translatePriority, translateDepartment } from "@/lib/ticket-utils"
import { deleteTicket } from "@/app/tickets/[id]/actions"
import { useAuth } from "@/hooks/use-auth"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

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
  profiles?: {
    full_name: string
    email: string
  } | null
  assigned_profile?: {
    full_name: string
    email: string
  } | null
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
  pending: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
}

interface TicketListProps {
  tickets: Ticket[]
  departments: string[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export function TicketList({ tickets, departments, totalCount, totalPages, currentPage }: TicketListProps) {
  const router = useRouter()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const { hasRole, profile } = useAuth()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  // Check if user can edit/delete tickets
  const canEditTicket = (ticket: Ticket) => {
    // Admins and Execs can edit any ticket
    if (hasRole(['admin', 'exec'])) return true

    // Managers can edit tickets in their department
    if (hasRole('manager') && profile?.department) {
      return ticket.department === profile.department || ticket.department === 'General'
    }

    // Employees cannot edit tickets
    return false
  }

  const canDeleteTicket = (ticket: Ticket) => {
    // Only managers, execs, and admins can delete
    if (!hasRole(['manager', 'exec', 'admin'])) return false

    // For managers, check department
    if (hasRole('manager') && profile?.department) {
      return ticket.department === profile.department || ticket.department === 'General'
    }

    return hasRole(['admin', 'exec'])
  }

  const handleRowClick = (ticketId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons or links
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) {
      return
    }
    router.push(`/tickets/${ticketId}`)
  }

  const handleDelete = async (ticketId: string) => {
    setDeletingId(ticketId)
    const result = await deleteTicket(ticketId)
    setDeletingId(null)

    if (result?.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  // Subscribe to realtime changes on audit_tickets table
  useEffect(() => {
    const channel = supabase
      .channel('ticket-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_tickets'
        },
        (payload) => {
          console.log('Ticket change detected:', payload)
          // Refresh the page to get updated data
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [router, supabase])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("tickets.title")}</CardTitle>
          <CardDescription>{t("tickets.cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TicketFilters departments={departments} />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tickets.ticket")}</TableHead>
                  <TableHead>{t("tickets.titleHeader")}</TableHead>
                  <TableHead>{t("tickets.department")}</TableHead>
                  <TableHead>{t("tickets.priority")}</TableHead>
                  <TableHead>{t("tickets.status")}</TableHead>
                  <TableHead>{t("tickets.assignedTo")}</TableHead>
                  <TableHead>{t("tickets.dueDate")}</TableHead>
                  <TableHead>{t("tickets.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {t("tickets.noTickets")}
                    </TableCell>
                  </TableRow>
                ) : (
                  tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={(e) => handleRowClick(ticket.id, e)}
                    >
                      <TableCell className="font-mono text-sm">
                        {ticket.ticket_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ticket.title || t("tickets.untitled")}</div>
                          {ticket.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {ticket.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {translateDepartment(ticket.department, t)}
                      </TableCell>
                      <TableCell>
                        <Badge className={priorityColors[ticket.priority as keyof typeof priorityColors]}>
                          {translatePriority(ticket.priority, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[ticket.status as keyof typeof statusColors]}>
                          {translateStatus(ticket.status, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ticket.assigned_profile ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span className="text-sm">{ticket.assigned_profile.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">{t("tickets.unassigned")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {ticket.due_date ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm">{formatDate(ticket.due_date, locale)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">{t("tickets.noDueDate")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/tickets/${ticket.id}`)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEditTicket(ticket) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/tickets/${ticket.id}/edit`)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteTicket(ticket) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingId === ticket.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(ticket.id)
                              }}
                              title={t("tickets.deleteTicket")}
                              className="text-destructive cursor-pointer"
                              onMouseEnter={(e) => {
                                if (deletingId !== ticket.id) {
                                  e.currentTarget.style.backgroundColor = 'hsl(0 84.2% 60.2%)'
                                  e.currentTarget.style.color = 'white'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (deletingId !== ticket.id) {
                                  e.currentTarget.style.backgroundColor = ''
                                  e.currentTarget.style.color = ''
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <TicketPagination totalCount={totalCount} totalPages={totalPages} currentPage={currentPage} />
        </CardContent>
      </Card>
    </div>
  )
}