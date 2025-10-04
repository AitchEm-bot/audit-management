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
import { GitCommit, MessageSquare, Edit, CheckCircle, AlertCircle, FileIcon, Activity, Pencil, Trash2, Save, X, Sparkles } from "lucide-react"
import { updateComment, deleteComment } from "@/app/tickets/[id]/actions"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { formatDateTime } from "@/lib/date-utils"
import { translateStatus, translatePriority } from "@/lib/ticket-utils"
import { cn } from "@/lib/utils"

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
}

interface TicketActivitiesClientProps {
  activities: TicketActivity[]
  currentUserId: string | null
  ticketId: string
  isTicketClosed?: boolean
}

function getActivityIcon(activityType: string) {
  switch (activityType) {
    case "comment":
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
    default:
      return <Activity className="h-4 w-4" />
  }
}

function getActivityColor(activityType: string) {
  switch (activityType) {
    case "comment":
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

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

            return (
              <div key={activity.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`p-2 rounded-full ${getActivityColor(activity.activity_type)} bg-gray-50`} style={isRTL ? { transform: 'scaleX(-1)' } : undefined}>
                    {getActivityIcon(activity.activity_type)}
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
                      {t(`tickets.activity${activity.activity_type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`)}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(activity.created_at, locale)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-700">
                    {activity.activity_type === "comment" && (
                      <div className={cn(
                        "p-3 rounded-lg border",
                        activity.metadata?.is_closing_comment
                          ? "bg-green-50 border-green-200"
                          : "bg-gray-50"
                      )}>
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="min-h-[80px]"
                              disabled={isUpdating}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveEdit(activity.id)}
                                disabled={isUpdating || !editContent.trim()}
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
                            <p className="whitespace-pre-wrap">{activity.content}</p>
                            {canModify && (
                              <div className="flex gap-2 mt-2 pt-2 border-t">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEdit(activity)}
                                  className="h-7 text-xs"
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  {t("common.edit")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => confirmDelete(activity.id)}
                                  className="h-7 text-xs text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  {t("common.delete")}
                                </Button>
                              </div>
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

                    {!["comment", "status_change", "assignment_change", "priority_change", "ticket_created"].includes(activity.activity_type) && (
                      <p>{activity.content}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

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