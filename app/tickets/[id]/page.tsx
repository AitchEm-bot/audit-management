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

  // Fetch ticket server-side
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
      // Add fallback profile data since we're not joining
      ticket = {
        ...data,
        profiles: { full_name: "Unknown User", email: "" },
        assigned_profile: null
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

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <TicketDetailClient ticket={ticket} />
        <TicketActivities ticketId={id} />
      </div>
    </div>
  )
}
