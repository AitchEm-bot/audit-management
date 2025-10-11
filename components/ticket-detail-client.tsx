"use client"

import { useState, useEffect, useRef } from "react"
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
  Paperclip,
  X,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { addComment, updateTicketStatus as updateTicketStatusAction } from "@/app/tickets/[id]/actions"
import { CloseTicketDialog } from "@/components/close-ticket-dialog"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { formatDate } from "@/lib/date-utils"
import { translateStatus, translatePriority, translateDepartment } from "@/lib/ticket-utils"

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
  requires_manager_approval?: boolean
  approval_status?: string | null
  manager_approved_by?: string | null
  manager_approved_at?: string | null
  approval_comment?: string | null
  resolution_comment?: string | null
  profiles: {
    full_name: string
    email: string
  } | null
  assigned_profile: {
    full_name: string
    email: string
  } | null
  manager_approver?: {
    full_name: string
    email: string
  } | null
}

interface TicketDetailClientProps {
  ticket: Ticket
  commentCount?: number
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
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)

  return (
    <Button
      type="submit"
      className="flex items-center gap-2"
      disabled={pending}
    >
      <Send className="h-4 w-4" />
      {pending ? t("tickets.posting") : t("tickets.comment")}
    </Button>
  )
}

export function TicketDetailClient({ ticket, commentCount: initialCommentCount = 0 }: TicketDetailClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get auth context for role-based permissions
  const { hasRole, profile, user } = useAuth()

  // Check if user can edit this ticket
  const canEditTicket = () => {
    if (hasRole(['admin', 'exec'])) return true
    if (hasRole('manager') && profile?.department) {
      return ticket.department === profile.department || ticket.department === 'General'
    }
    return false
  }

  // Users can change status if ticket is in their department or General department
  // Note: When employees try to set status to 'closed', it opens the CloseTicketDialog instead
  const canChangeStatus = () => {
    if (hasRole(['admin', 'exec'])) return true
    // Managers, employees can change status for tickets in their department or General
    if (profile?.department) {
      return ticket.department === profile.department || ticket.department === 'General'
    }
    return false
  }

  // Get success/error messages from URL
  const successMessage = searchParams.get('success')
  const errorMessage = searchParams.get('error')

  // Update comment count when prop changes
  useEffect(() => {
    setCommentCount(initialCommentCount)
  }, [initialCommentCount])

  // Clear selected files when form is successfully submitted
  useEffect(() => {
    if (successMessage) {
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [successMessage])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    addFiles(files)
    // Reset the input so the same file can be selected again
    e.target.value = ''
  }

  const addFiles = (files: File[]) => {
    // Validate file count
    if (selectedFiles.length + files.length > 5) {
      alert(t('tickets.maxFiles'))
      return
    }
    // Validate file sizes (50MB = 52428800 bytes)
    const invalidFiles = files.filter(f => f.size > 52428800)
    if (invalidFiles.length > 0) {
      alert(t('tickets.maxFileSize'))
      return
    }
    setSelectedFiles([...selectedFiles, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }

  // Update the hidden file input whenever selectedFiles changes
  useEffect(() => {
    if (fileInputRef.current && selectedFiles.length > 0) {
      const dataTransfer = new DataTransfer()
      selectedFiles.forEach(file => {
        dataTransfer.items.add(file)
      })
      fileInputRef.current.files = dataTransfer.files
      console.log('📎 Updated hidden file input with', selectedFiles.length, 'files')
    }
  }, [selectedFiles])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const updateTicketStatus = async (newStatus: string) => {
    // If trying to close the ticket, show the dialog instead
    if (newStatus === "closed") {
      console.log('Status changed to closed, opening dialog for ticket:', ticket.id)
      setShowCloseDialog(true)
      return
    }

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
      {/* Close Ticket Dialog */}
      <CloseTicketDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        ticketId={ticket.id}
        commentCount={commentCount}
      />

      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{ticket.title}</h1>
          <p className="text-muted-foreground font-mono">{ticket.ticket_number}</p>
        </div>
        {canEditTicket() && (
          <Button variant="outline" asChild>
            <Link href={`/tickets/${ticket.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              {t("common.edit")}
            </Link>
          </Button>
        )}
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle
            className="h-4 w-4 text-green-600"
            style={locale === 'ar' ? { transform: 'scaleX(1)' } : undefined}
          />
          <AlertDescription className="text-green-800">
            {successMessage.includes('Comment added')
              ? t('tickets.commentAdded')
              : successMessage === 'closureRequested'
              ? t('tickets.closureRequested')
              : successMessage}
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle
            className="h-4 w-4 text-red-600"
            style={locale === 'ar' ? { transform: 'scaleX(1)' } : undefined}
          />
          <AlertDescription className="text-red-800">
            {errorMessage === 'pleaseProvideCommentOrFile' ? t('common.pleaseProvideCommentOrFile') : errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Approval Status Alerts */}
      {ticket.approval_status === 'pending' && (
        <Alert className="border-blue-200 bg-blue-50">
          <Clock
            className="h-4 w-4 text-blue-600"
            style={locale === 'ar' ? { transform: 'scaleX(1)' } : undefined}
          />
          <AlertDescription className="text-blue-800">
            <p className="font-medium">{t('tickets.awaitingManagerApproval')}</p>
            {ticket.resolution_comment && (
              <p className="mt-2 text-sm">{t('tickets.yourClosingComment')}: {ticket.resolution_comment}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {ticket.approval_status === 'approved' && ticket.manager_approver && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle
            className="h-4 w-4 text-green-600"
            style={locale === 'ar' ? { transform: 'scaleX(1)' } : undefined}
          />
          <AlertDescription className="text-green-800">
            <p className="font-medium">{t('tickets.closureApproved')}</p>
            <p className="mt-1 text-sm">
              {t('tickets.approvedBy')}: {ticket.manager_approver.full_name}
            </p>
            {ticket.approval_comment && (
              <p className="mt-2 text-sm italic">"{ticket.approval_comment}"</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {ticket.approval_status === 'rejected' && ticket.manager_approver && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle
            className="h-4 w-4 text-red-600"
            style={locale === 'ar' ? { transform: 'scaleX(1)' } : undefined}
          />
          <AlertDescription className="text-red-800">
            <p className="font-medium">{t('tickets.closureRejected')}</p>
            <p className="mt-1 text-sm">
              {t('tickets.rejectedBy')}: {ticket.manager_approver.full_name}
            </p>
            {ticket.approval_comment && (
              <p className="mt-2 text-sm font-medium">{t('tickets.rejectionReason')}: "{ticket.approval_comment}"</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Ticket Description */}
          <Card>
            <CardHeader>
              <CardTitle>{t("tickets.description")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Add Comment Form */}
          {ticket.status !== 'closed' && (
            <Card>
              <CardHeader>
                <CardTitle>{t("tickets.addComment")}</CardTitle>
                <CardDescription>
                  {t("tickets.addCommentDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={addComment.bind(null, ticket.id)} className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative ${isDragging ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''}`}
                  >
                    <Textarea
                      name="content"
                      placeholder={t("tickets.commentPlaceholder")}
                      className="min-h-[100px]"
                    />
                    {isDragging && (
                      <div className="absolute inset-0 bg-primary/5 rounded-lg flex items-center justify-center pointer-events-none">
                        <p className="text-sm text-primary font-medium">{t("tickets.dropFilesHere")}</p>
                      </div>
                    )}
                  </div>

                  {/* File Upload Section */}
                  <div className="space-y-2">
                    {/* Hidden file input that will be submitted with the form */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      name="files"
                      multiple
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="file-upload"
                        multiple
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={selectedFiles.length >= 5}
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        {t("tickets.attachFile")}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {t("tickets.maxFileSize")} • {t("tickets.maxFiles")}
                      </span>
                    </div>

                    {/* Selected Files Preview */}
                    {selectedFiles.length > 0 && (
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                            <Paperclip className="h-4 w-4 text-gray-500" />
                            <span className="text-sm flex-1 truncate">{file.name}</span>
                            <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <CommentSubmitButton />
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
          {ticket.status === 'closed' && (
            <Card>
              <CardHeader>
                <CardTitle>{t("tickets.commentsLocked")}</CardTitle>
                <CardDescription>
                  {t("tickets.commentsLockedDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status and Priority */}
          <Card>
            <CardHeader>
              <CardTitle>{t("tickets.details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("tickets.status")}</label>
                <div className="mt-1">
                  {canChangeStatus() ? (
                    <Select
                      value={ticket.status}
                      onValueChange={updateTicketStatus}
                      disabled={statusUpdating}
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
                  ) : (
                    <Badge className={statusColors[ticket.status as keyof typeof statusColors]}>
                      {translateStatus(ticket.status, t)}
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("tickets.priority")}</label>
                <div className="mt-1">
                  <Badge className={priorityColors[ticket.priority as keyof typeof priorityColors]}>
                    {translatePriority(ticket.priority, t)}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("tickets.department")}</label>
                <p className="text-sm">{translateDepartment(ticket.department, t)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("tickets.created")}</label>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  {formatDate(ticket.created_at, locale)}
                </div>
              </div>

              {ticket.due_date && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t("tickets.dueDate")}</label>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    {formatDate(ticket.due_date, locale)}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("tickets.assignedTo")}</label>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  {ticket.assigned_profile?.full_name || t("tickets.unassigned")}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Request Closure Button (for employees only) */}
          {!canChangeStatus() && ticket.status !== 'closed' && ticket.approval_status !== 'pending' && (
            <Card>
              <CardHeader>
                <CardTitle>{t("tickets.closeTicket")}</CardTitle>
                <CardDescription>
                  {t("tickets.requestClosureDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setShowCloseDialog(true)}
                  className="w-full"
                  variant="default"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t("tickets.requestClosure")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}