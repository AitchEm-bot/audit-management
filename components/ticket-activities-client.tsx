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
import { GitCommit, MessageSquare, Edit, CheckCircle, AlertCircle, FileIcon, Activity, Pencil, Trash2, Save, X } from "lucide-react"
import { format } from "date-fns"
import { updateComment, deleteComment } from "@/app/tickets/[id]/actions"
import { useRouter } from "next/navigation"

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
}: TicketActivitiesClientProps) {
  const router = useRouter()
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
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">No activities yet. Be the first to comment!</p>
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
            Activity Timeline ({activities.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activities.map((activity, index) => {
            const isEditing = editingId === activity.id
            const canModify = currentUserId === activity.user_id && activity.activity_type === "comment"

            return (
              <div key={activity.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`p-2 rounded-full ${getActivityColor(activity.activity_type)} bg-gray-50`}>
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
                      {activity.activity_type.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {format(new Date(activity.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>

                  <div className="text-sm text-gray-700">
                    {activity.activity_type === "comment" && (
                      <div className="bg-gray-50 p-3 rounded-lg border">
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
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                                disabled={isUpdating}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
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
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => confirmDelete(activity.id)}
                                  className="h-7 text-xs text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {activity.activity_type === "status_change" && (
                      <p>
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
                      <p>
                        {activity.old_value
                          ? `Reassigned from ${activity.old_value} to ${activity.new_value}`
                          : `Assigned to ${activity.new_value}`}
                      </p>
                    )}

                    {activity.activity_type === "priority_change" && (
                      <p>
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

                    {activity.activity_type === "ticket_created" && (
                      <p>Created this ticket</p>
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
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isUpdating}
              className="bg-red-600 hover:bg-red-700"
            >
              {isUpdating ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}