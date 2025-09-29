import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GitCommit, MessageSquare, Edit, CheckCircle, AlertCircle, FileIcon, Activity } from "lucide-react"
import { format } from "date-fns"

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

interface TicketActivitiesProps {
  ticketId: string
}

async function fetchActivities(ticketId: string): Promise<TicketActivity[]> {
  const supabase = await createClient()

  console.log("🔍 Server-side fetchActivities called for ticket:", ticketId)

  try {
    const { data: activities, error } = await supabase
      .from("ticket_activities")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("❌ Server-side activities query error:", error)
      return []
    }

    console.log("✅ Server-side successfully fetched activities:", activities?.length || 0)

    // Fetch user profiles for all activities
    const userIds = [...new Set((activities || []).map(a => a.user_id).filter(Boolean))]
    let profileMap = new Map()

    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)

      if (!profileError && profiles) {
        profileMap = new Map(profiles.map(p => [p.id, p]))
      }
    }

    // Enrich activities with profile data
    const activitiesWithProfiles = (activities || []).map(activity => ({
      ...activity,
      profiles: profileMap.get(activity.user_id) || { full_name: "Unknown User", email: "" }
    }))

    return activitiesWithProfiles
  } catch (error) {
    console.error("💥 Server-side unexpected error fetching activities:", error)
    return []
  }
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

export default async function TicketActivities({ ticketId }: TicketActivitiesProps) {
  const activities = await fetchActivities(ticketId)

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Timeline ({activities.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity, index) => (
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
                    <p className="whitespace-pre-wrap">{activity.content}</p>
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
        ))}
      </CardContent>
    </Card>
  )
}