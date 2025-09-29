import { createClient } from "@/lib/supabase/server"
import TicketActivitiesClient from "./ticket-activities-client"

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

export default async function TicketActivities({ ticketId }: TicketActivitiesProps) {
  const supabase = await createClient()
  const activities = await fetchActivities(ticketId)

  // Get current user ID
  const { data: { user } } = await supabase.auth.getUser()
  const currentUserId = user?.id || null

  return (
    <TicketActivitiesClient
      activities={activities}
      currentUserId={currentUserId}
      ticketId={ticketId}
    />
  )
}