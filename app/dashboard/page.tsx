import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DashboardMetrics } from "@/components/dashboard-metrics"
import { Upload, FileText, BarChart3 } from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

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

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Audit Management Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back! Here's an overview of your audit management system.
          </p>
        </div>

        <DashboardMetrics initialStats={stats} />

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload CSV
                </CardTitle>
                <CardDescription>Import audit findings from CSV files to create tickets automatically</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/upload">Upload CSV File</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  View Tickets
                </CardTitle>
                <CardDescription>Browse, filter, and manage all audit tickets in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full bg-transparent" variant="outline">
                  <Link href="/tickets">View All Tickets</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Reports
                </CardTitle>
                <CardDescription>Generate comprehensive audit reports and export data</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full bg-transparent" variant="outline">
                  <Link href="/reports">Generate Reports</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
