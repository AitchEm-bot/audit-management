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

  // Fetch tickets server-side for metrics
  let tickets = []
  try {
    const { data, error } = await supabase
      .from("audit_tickets")
      .select("*")

    if (error) {
      console.error("Error fetching tickets for dashboard:", error)
    } else {
      tickets = data || []
      console.log("Dashboard fetched tickets:", tickets.length)
    }
  } catch (error) {
    console.error("Server error fetching tickets for dashboard:", error)
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

        <DashboardMetrics initialTickets={tickets} />

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
