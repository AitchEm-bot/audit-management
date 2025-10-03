"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, ChevronLeft, ChevronRight, Edit, Eye, User } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { TicketFilters } from "./ticket-filters"
import { TicketPagination } from "./ticket-pagination"

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
  resolved: "bg-green-100 text-green-800",
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

  const handleRowClick = (ticketId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons or links
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) {
      return
    }
    router.push(`/tickets/${ticketId}`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Audit Tickets</CardTitle>
          <CardDescription>Manage and track audit findings and remediation efforts</CardDescription>
        </CardHeader>
        <CardContent>
          <TicketFilters departments={departments} />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No tickets found matching your criteria
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
                        <Link href={`/tickets/${ticket.id}`} className="block w-full">
                          {ticket.ticket_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/tickets/${ticket.id}`} className="block w-full hover:underline">
                          <div>
                            <div className="font-medium">{ticket.title || "Untitled"}</div>
                            {ticket.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-xs">
                                {ticket.description}
                              </div>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/tickets/${ticket.id}`} className="block w-full">
                          {ticket.department}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/tickets/${ticket.id}`} className="block w-full">
                          <Badge className={priorityColors[ticket.priority as keyof typeof priorityColors]}>
                            {ticket.priority}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/tickets/${ticket.id}`} className="block w-full">
                          <Badge className={statusColors[ticket.status as keyof typeof statusColors]}>
                            {ticket.status.replace("_", " ")}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/tickets/${ticket.id}`} className="block w-full">
                          {ticket.assigned_profile ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span className="text-sm">{ticket.assigned_profile.full_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unassigned</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/tickets/${ticket.id}`} className="block w-full">
                          {ticket.due_date ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span className="text-sm">{format(new Date(ticket.due_date), "MMM dd, yyyy")}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No due date</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/tickets/${ticket.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/tickets/${ticket.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
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