import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ReportGenerator } from "@/components/report-generator"

export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Audit Reports</h1>
          <p className="text-muted-foreground mt-2">
            Generate comprehensive Excel reports with customizable filters and options
          </p>
        </div>

        <ReportGenerator />
      </div>
    </div>
  )
}
