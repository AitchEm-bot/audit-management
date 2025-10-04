import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ReportGenerator } from "@/components/report-generator"
import { useTranslation } from "@/lib/translations"
import { cookies } from "next/headers"

export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const cookieStore = await cookies()
  const locale = (cookieStore.get("locale")?.value as "en" | "ar") || "en"
  const { t } = useTranslation(locale)

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t("reports.auditReports")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("reports.pageDescription")}
          </p>
        </div>

        <ReportGenerator />
      </div>
    </div>
  )
}
