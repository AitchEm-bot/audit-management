"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GitCommit, MessageSquare, Edit, CheckCircle, AlertCircle, FileIcon, Activity, Pencil, Trash2, Save, X, Sparkles, MoreVertical } from "lucide-react"
import { updateComment, deleteComment } from "@/app/tickets/[id]/actions"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { formatDateTime } from "@/lib/date-utils"
import { translateStatus, translatePriority } from "@/lib/ticket-utils"
import { cn } from "@/lib/utils"
import { AttachmentDisplay } from "@/components/attachment-display"
import { ApprovalDialog } from "@/components/approval-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"

interface Attachment {
  id: string
  filename: string
  file_path: string
  file_size: number
  mime_type: string
  created_at: string
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
  } | null
  ticket_comment_attachments?: Attachment[]
}

interface TicketActivitiesClientProps {
  activities: TicketActivity[]
  currentUserId: string | null
  ticketId: string
  isTicketClosed?: boolean
}

function getActivityIcon(activityType: string, activity?: TicketActivity) {
  switch (activityType) {
    case "comment":
      // Use file icon for file-only comments (no text content)
      if (activity && (!activity.content || activity.content.trim() === '') &&
          activity.ticket_comment_attachments && activity.ticket_comment_attachments.length > 0) {
        return <FileIcon className="h-4 w-4" />
      }
      return <MessageSquare className="h-4 w-4" />
    case "status_change":
      return <CheckCircle className="h-4 w-4" />
    case "assignment_change":
      return <Edit className="h-4 w-4" />
    case "priority_change":
      return <AlertCircle className="h-4 w-4" />
    case "file_attachment":
      return <FileIcon className="h-4 w-4" />
    case "ticket_created":
      return <GitCommit className="h-4 w-4" />
    case "closure_request":
      return <AlertCircle className="h-4 w-4" />
    case "approval_response":
      return activity?.metadata?.approved ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />
    default:
      return <Activity className="h-4 w-4" />
  }
}

function getActivityColor(activityType: string, activity?: TicketActivity) {
  switch (activityType) {
    case "comment":
      // Use gray color for file-only comments (matches file_attachment color)
      if (activity && (!activity.content || activity.content.trim() === '') &&
          activity.ticket_comment_attachments && activity.ticket_comment_attachments.length > 0) {
        return "text-gray-600"
      }
      return "text-blue-600"
    case "status_change":
      return "text-green-600"
    case "assignment_change":
      return "text-purple-600"
    case "priority_change":
      return "text-orange-600"
    case "file_attachment":
      return "text-gray-600"
    case "ticket_created":
      return "text-indigo-600"
    case "closure_request":
      return "text-yellow-600"
    case "approval_response":
      return activity?.metadata?.approved ? "text-green-600" : "text-red-600"
    default:
      return "text-gray-500"
  }
}

export default function TicketActivitiesClient({
  activities,
  currentUserId,
  ticketId,
  isTicketClosed = false,
}: TicketActivitiesClientProps) {
  const router = useRouter()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const { hasRole, profile } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [selectedClosureRequest, setSelectedClosureRequest] = useState<any>(null)

  const startEdit = (activity: TicketActivity) => {
    setEditingId(activity.id)
    setEditContent(activity.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent("")
  }

  const saveEdit = async (activityId: string) => {
    setIsUpdating(true)
    try {
      const result = await updateComment(activityId, editContent)
      if (result?.error) {
        alert(result.error)
      } else {
        setEditingId(null)
        setEditContent("")
        router.refresh()
      }
    } catch (error) {
      console.error("Error updating comment:", error)
      alert("Failed to update comment")
    } finally {
      setIsUpdating(false)
    }
  }

  const hasAttachments = (activity: TicketActivity) => {
    return activity.ticket_comment_attachments && activity.ticket_comment_attachments.length > 0
  }

  const confirmDelete = (activityId: string) => {
    setActivityToDelete(activityId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!activityToDelete) return

    setIsUpdating(true)
    try {
      const result = await deleteComment(activityToDelete, ticketId)
      if (result?.error) {
        alert(result.error)
      } else {
        setDeleteDialogOpen(false)
        setActivityToDelete(null)
        router.refresh()
      }
    } catch (error) {
      console.error("Error deleting comment:", error)
      alert("Failed to delete comment")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleApprovalRequest = async (activity: TicketActivity) => {
    // Get ticket details for the approval dialog
    const supabase = createClient()
    const { data: ticket } = await supabase
      .from('audit_tickets')
      .select('ticket_number, title, resolution_comment')
      .eq('id', ticketId)
      .single()

    if (ticket) {
      setSelectedClosureRequest({
        id: ticketId,
        ticket_number: ticket.ticket_number,
        title: ticket.title,
        resolution_comment: activity.content,
        requester_name: activity.profiles?.full_name || 'Unknown'
      })
      setShowApprovalDialog(true)
    }
  }

  const handleApprovalComplete = () => {
    setShowApprovalDialog(false)
    setSelectedClosureRequest(null)
    router.refresh()
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t("tickets.activityTimeline")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">{t("tickets.noActivitiesYet")}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t("tickets.activityTimeline")} ({activities.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activities.map((activity, index) => {
            const isEditing = editingId === activity.id
            const canModify = !isTicketClosed && currentUserId === activity.user_id && activity.activity_type === "comment"

            const isRTL = locale === 'ar'

            // Skip standalone file_attachment activities (they're shown inline with comments)
            // Only show file_attachment if it's a file-only comment (has attachments in metadata)
            if (activity.activity_type === "file_attachment") {
              return null
            }

            return (
              <div key={activity.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`p-2 rounded-full ${getActivityColor(activity.activity_type, activity)} bg-gray-50`} style={isRTL ? { transform: 'scaleX(-1)' } : undefined}>
                    {getActivityIcon(activity.activity_type, activity)}
                  </div>
                  {index < activities.length - 1 && (
                    <div className="w-px h-8 bg-gray-200 mt-2" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {activity.profiles?.full_name || "Unknown User"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {activity.activity_type === "comment" && (!activity.content || activity.content.trim() === '') && activity.ticket_comment_attachments && activity.ticket_comment_attachments.length > 0
                        ? t("tickets.activityFileAttachment")
                        : t(`tickets.activity${activity.activity_type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`)}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(activity.created_at, locale)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-700">
                    {activity.activity_type === "comment" && (
                      <div className={cn(
                        "p-3 rounded-lg border relative",
                        activity.metadata?.is_closing_comment
                          ? "bg-green-50 border-green-200"
                          : "bg-gray-50"
                      )}>
                        {/* More menu - positioned absolutely in corner (right for LTR, left for RTL) */}
                        {canModify && !isEditing && (
                          <div className={cn(
                            "absolute top-2",
                            isRTL ? "left-2" : "right-2"
                          )}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-gray-200"
                                  title={t("common.more") || "More"}
                                >
                                  <MoreVertical className="h-4 w-4 text-gray-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={isRTL ? "start" : "end"}>
                                <DropdownMenuItem onClick={() => startEdit(activity)}>
                                  <Pencil className="h-3 w-3 mr-2" />
                                  {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => confirmDelete(activity.id)}
                                  className="text-red-600 focus:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3 mr-2" />
                                  {t("common.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}

                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="min-h-[80px]"
                              disabled={isUpdating}
                            />

                            {/* Display attachments in edit mode */}
                            {activity.ticket_comment_attachments && activity.ticket_comment_attachments.length > 0 && (
                              <AttachmentDisplay
                                attachments={activity.ticket_comment_attachments}
                                canDelete={canModify && !isTicketClosed}
                                activityId={activity.id}
                                isEditing={true}
                                hasContent={editContent && editContent.trim() !== ''}
                              />
                            )}

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveEdit(activity.id)}
                                disabled={isUpdating || (!editContent.trim() && !hasAttachments(activity))}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                {t("common.save")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                                disabled={isUpdating}
                              >
                                <X className="h-3 w-3 mr-1" />
                                {t("common.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {activity.metadata?.is_closing_comment && (
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-green-300">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-xs font-medium text-green-700">
                                  {t("tickets.closingComment")}
                                </span>
                                {activity.metadata?.ai_generated && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    {t("tickets.aiGenerated")}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {activity.content && activity.content.trim() !== '' && (
                              <p className="whitespace-pre-wrap">{activity.content}</p>
                            )}

                            {/* Display attachments */}
                            {activity.ticket_comment_attachments && activity.ticket_comment_attachments.length > 0 && (
                              <AttachmentDisplay
                                attachments={activity.ticket_comment_attachments}
                                canDelete={canModify && !isTicketClosed}
                                activityId={activity.id}
                                isEditing={false}
                                hasContent={activity.content && activity.content.trim() !== ''}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {activity.activity_type === "status_change" && (
                      <p>
                        {t("tickets.changedStatusFrom")}{" "}
                        <Badge variant="outline" className="text-xs">
                          {activity.old_value ? translateStatus(activity.old_value, t) : activity.old_value}
                        </Badge>{" "}
                        {t("tickets.to")}{" "}
                        <Badge variant="outline" className="text-xs">
                          {activity.new_value ? translateStatus(activity.new_value, t) : activity.new_value}
                        </Badge>
                      </p>
                    )}

                    {activity.activity_type === "assignment_change" && (
                      <p>
                        {activity.old_value
                          ? `${t("tickets.reassignedFrom")} ${activity.metadata?.old_user_name || activity.old_value} ${t("tickets.to")} ${activity.metadata?.new_user_name || activity.new_value}`
                          : `${t("tickets.assignedToUser")} ${activity.metadata?.new_user_name || activity.new_value}`}
                      </p>
                    )}

                    {activity.activity_type === "priority_change" && (
                      <p>
                        {t("tickets.changedPriorityFrom")}{" "}
                        <Badge variant="outline" className="text-xs">
                          {activity.old_value ? translatePriority(activity.old_value, t) : activity.old_value}
                        </Badge>{" "}
                        {t("tickets.to")}{" "}
                        <Badge variant="outline" className="text-xs">
                          {activity.new_value ? translatePriority(activity.new_value, t) : activity.new_value}
                        </Badge>
                      </p>
                    )}

                    {activity.activity_type === "ticket_created" && (
                      <p>{t("tickets.createdThisTicket")}</p>
                    )}

                    {activity.activity_type === "closure_request" && (
                      <div className="p-4 rounded-lg border-2 border-yellow-300 bg-yellow-50">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-5 w-5 text-yellow-700" />
                          <span className="font-semibold text-yellow-800">
                            {t("tickets.closureRequested")}
                          </span>
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-400">
                            {t("tickets.pendingReview")}
                          </Badge>
                        </div>
                        <div className="mt-2 p-3 bg-white rounded border text-sm">
                          <span className="font-medium">{t("tickets.reason")}:</span>
                          <p className="mt-1 whitespace-pre-wrap text-gray-700">{activity.content}</p>
                        </div>
                        {hasRole(['manager', 'exec', 'admin']) && !isTicketClosed && activity.metadata?.approval_status === 'pending' && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprovalRequest(activity)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {t("tickets.reviewRequest")}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {activity.activity_type === "approval_response" && (
                      <div className={cn(
                        "p-4 rounded-lg border-2",
                        activity.metadata?.approved
                          ? "border-green-300 bg-green-50"
                          : "border-red-300 bg-red-50"
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          {activity.metadata?.approved ? (
                            <>
                              <CheckCircle className="h-5 w-5 text-green-700" />
                              <span className="font-semibold text-green-800">
                                {t("tickets.closureApproved")}
                              </span>
                              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-400">
                                {t("tickets.approved")}
                              </Badge>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-5 w-5 text-red-700" />
                              <span className="font-semibold text-red-800">
                                {t("tickets.closureRejected")}
                              </span>
                              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-400">
                                {t("tickets.rejected")}
                              </Badge>
                            </>
                          )}
                        </div>
                        {activity.content && activity.content.trim() !== '' && (
                          <div className="mt-2 p-3 bg-white rounded border text-sm">
                            <span className="font-medium">{t("tickets.managerComment")}:</span>
                            <p className="mt-1 whitespace-pre-wrap text-gray-700">{activity.content}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {!["comment", "status_change", "assignment_change", "priority_change", "ticket_created", "closure_request", "approval_response"].includes(activity.activity_type) && (
                      <p>{activity.content}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      {selectedClosureRequest && (
        <ApprovalDialog
          open={showApprovalDialog}
          onOpenChange={setShowApprovalDialog}
          ticket={selectedClosureRequest}
          onComplete={handleApprovalComplete}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tickets.deleteComment")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tickets.deleteCommentConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isUpdating}
              className="bg-red-600 hover:bg-red-700"
            >
              {isUpdating ? t("tickets.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}