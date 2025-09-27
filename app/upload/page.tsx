import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CSVUpload } from "@/components/csv-upload"

export default async function UploadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Upload Audit Data</h1>
          <p className="text-muted-foreground mt-2">
            Upload CSV files to automatically create audit tickets for your organization
          </p>
        </div>

        <CSVUpload />
      </div>
    </div>
  )
}
