import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardContent } from "@/components/dashboard-content"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single()

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'there'

  // Use full query server-side since server-side queries work fine
  let stats = null
  try {
    // Fetch all ticket data to calculate proper stats
    const { data: tickets, error } = await supabase
      .from("audit_tickets")
      .select("status, priority, department, due_date, created_at")

    if (error) {
      console.error("Error fetching tickets for dashboard stats:", error)
      // Fallback to basic count only
      const { count } = await supabase
        .from("audit_tickets")
        .select("*", { count: "exact", head: true })

      stats = {
        total: count || 0,
        open: 0, in_progress: 0, resolved: 0, closed: 0,
        critical: 0, high: 0, medium: 0, low: 0,
        overdue: 0, recent_7_days: 0, departments: {}
      }
    } else {
      // Calculate full stats server-side
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      stats = {
        total: tickets?.length || 0,
        open: 0, in_progress: 0, resolved: 0, closed: 0,
        critical: 0, high: 0, medium: 0, low: 0,
        overdue: 0, recent_7_days: 0, departments: {}
      }

      tickets?.forEach((ticket) => {
        // Status counts
        const status = ticket.status?.toLowerCase()
        if (status === "open") stats.open++
        else if (status === "in_progress") stats.in_progress++
        else if (status === "resolved") stats.resolved++
        else if (status === "closed") stats.closed++

        // Priority counts
        const priority = ticket.priority?.toLowerCase()
        if (priority === "critical") stats.critical++
        else if (priority === "high") stats.high++
        else if (priority === "medium") stats.medium++
        else if (priority === "low") stats.low++

        // Department counts
        if (ticket.department) {
          stats.departments[ticket.department] = (stats.departments[ticket.department] || 0) + 1
        }

        // Overdue and recent tickets
        if (ticket.due_date && new Date(ticket.due_date) < now &&
            status !== "resolved" && status !== "closed") {
          stats.overdue++
        }
        if (new Date(ticket.created_at) > sevenDaysAgo) {
          stats.recent_7_days++
        }
      })

      console.log("Full dashboard stats calculated server-side:", stats)
    }
  } catch (error) {
    console.error("Server error fetching dashboard stats:", error)
    // Provide default empty stats
    stats = {
      total: 0,
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      overdue: 0,
      recent_7_days: 0,
      departments: {}
    }
  }

  return <DashboardContent displayName={displayName} stats={stats} />
}
