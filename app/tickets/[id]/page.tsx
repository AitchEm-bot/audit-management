import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TicketDetailClient } from "@/components/ticket-detail-client"
import TicketActivities from "@/components/ticket-activities"

interface TicketPageProps {
  params: Promise<{ id: string }>
}

export default async function TicketPage({ params }: TicketPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch ticket server-side with approval fields
  let ticket = null
  try {
    const { data, error } = await supabase
      .from("audit_tickets")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("Error fetching ticket server-side:", error)
    } else {
      // Fetch assigned user profile if ticket is assigned
      let assignedProfile = null
      if (data.assigned_to) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", data.assigned_to)
          .single()

        assignedProfile = profile
      }

      // Fetch manager approver profile if ticket was approved
      let managerApprover = null
      if (data.manager_approved_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", data.manager_approved_by)
          .single()

        managerApprover = profile
      }

      ticket = {
        ...data,
        profiles: { full_name: "Unknown User", email: "" },
        assigned_profile: assignedProfile,
        manager_approver: managerApprover
      }
      console.log("Fetched ticket server-side:", ticket?.title)
    }
  } catch (error) {
    console.error("Server error fetching ticket:", error)
  }

  // If ticket not found, redirect to tickets list
  if (!ticket) {
    redirect("/tickets")
  }

  // Fetch comment count for the close dialog
  let commentCount = 0
  try {
    const { data: comments } = await supabase
      .from("ticket_activities")
      .select("id")
      .eq("ticket_id", id)
      .eq("activity_type", "comment")

    commentCount = comments?.length || 0
  } catch (error) {
    console.error("Error fetching comment count:", error)
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <TicketDetailClient ticket={ticket} commentCount={commentCount} />
        <TicketActivities ticketId={id} isTicketClosed={ticket.status === 'closed'} />
      </div>
    </div>
  )
}
