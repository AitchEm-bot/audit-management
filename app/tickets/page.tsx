import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TicketList } from "@/components/ticket-list"

interface PageProps {
  searchParams?: {
    page?: string
    status?: string
    priority?: string
    department?: string
  }
}

export default async function TicketsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Use simplified query for server-side rendering to avoid relationship errors
  let tickets = []

  try {
    // Simple query without joins to ensure it works
    const { data, error } = await supabase
      .from("audit_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20) // Start with basic pagination

    if (error) {
      console.error("Error fetching tickets server-side:", error)
    } else {
      tickets = data || []
      console.log(`Fetched ${tickets.length} tickets server-side`)
    }
  } catch (error) {
    console.error("Server error fetching tickets:", error)
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Audit Tickets</h1>
          <p className="text-muted-foreground mt-2">View and manage all audit findings and remediation tasks</p>
        </div>

        <TicketList initialTickets={tickets} pageSize={20} />
      </div>
    </div>
  )
}
