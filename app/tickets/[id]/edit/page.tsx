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

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <EditTicketForm ticket={ticket} />
      </div>
    </div>
  )
}