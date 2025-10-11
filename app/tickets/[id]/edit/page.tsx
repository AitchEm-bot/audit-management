import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { EditTicketForm } from "@/components/edit-ticket-form"

interface EditTicketPageProps {
  params: Promise<{ id: string }>
}

export default async function EditTicketPage({ params }: EditTicketPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch ticket server-side
  const { data: ticket, error } = await supabase
    .from("audit_tickets")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !ticket) {
    redirect("/tickets")
  }

  // Fetch users by department server-side
  let availableUsers = []
  if (ticket.department && ticket.department !== "General") {
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, full_name, email, department")
      .eq("department", ticket.department)
      .order("full_name", { ascending: true })

    if (!usersError && users) {
      availableUsers = users
    }
  }

  // Fetch user profile with role
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department")
    .eq("id", user.id)
    .single()

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
      <div className="max-w-4xl mx-auto">
        <EditTicketForm
          ticket={ticket}
          availableUsers={availableUsers}
          commentCount={commentCount}
          userProfile={userProfile}
        />
      </div>
    </div>
  )
}