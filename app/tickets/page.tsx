import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createSupabaseQueries } from "@/lib/supabase/queries"
import { TicketsPageContent } from "@/components/tickets-page-content"

interface PageProps {
  searchParams?: {
    page?: string
    search?: string
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

  const queries = createSupabaseQueries(supabase)

  // Get user profile for role-based filtering
  const userProfile = await queries.getCurrentUserProfile()

  // Parse search params
  const page = parseInt(searchParams?.page || "1", 10)
  const pageSize = 20

  // Build filters from URL params
  // Default to "all" (show all statuses) if no status filter is set
  const statusParam = searchParams?.status ?? "all"

  const filters = {
    status: statusParam === "all" ? undefined : statusParam,
    priority: searchParams?.priority && searchParams.priority !== "all" ? searchParams.priority : undefined,
    department: searchParams?.department && searchParams.department !== "all" ? searchParams.department : undefined,
    searchTerm: searchParams?.search || undefined,
  }

  // Fetch departments for filter dropdown
  const { data: departmentsData } = await queries.getDepartments()
  const departments = departmentsData || []

  // Fetch tickets with filters
  let tickets = []
  let totalCount = 0
  let totalPages = 1

  try {
    const { data, count, pageInfo, error } = await queries.getTicketsPaginated(
      filters,
      { page, pageSize },
      { column: "created_at", ascending: false },
      userProfile // Pass user profile for role-based filtering
    )

    if (error) {
      console.error("Error fetching tickets server-side:", error)
    } else {
      tickets = data || []
      totalCount = count || 0
      totalPages = pageInfo?.totalPages || 1

      // Fetch user profiles for assigned users
      const assignedUserIds = tickets
        .filter((t: any) => t.assigned_to)
        .map((t: any) => t.assigned_to)

      if (assignedUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", assignedUserIds)

        if (profiles) {
          tickets = tickets.map((ticket: any) => ({
            ...ticket,
            assigned_profile: profiles.find((p) => p.id === ticket.assigned_to) || null,
          }))
        }
      }

      console.log(`Fetched ${tickets.length} tickets server-side (page ${page}, total: ${totalCount})`)
    }
  } catch (error) {
    console.error("Server error fetching tickets:", error)
  }

  return (
    <TicketsPageContent
      tickets={tickets}
      departments={departments}
      totalCount={totalCount}
      totalPages={totalPages}
      currentPage={page}
    />
  )
}