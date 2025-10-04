"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DashboardMetrics } from "@/components/dashboard-metrics"
import { Upload, FileText, BarChart3 } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"

interface DashboardContentProps {
  displayName: string
  stats: any
}

export function DashboardContent({ displayName, stats }: DashboardContentProps) {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t("dashboard.greeting", { name: displayName })}</h1>
          <p className="text-muted-foreground mt-2">
            {t("dashboard.overview")}
          </p>
        </div>

        <DashboardMetrics initialStats={stats} />

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">{t("dashboard.quickActions")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  {t("dashboard.uploadCSV")}
                </CardTitle>
                <CardDescription>{t("dashboard.uploadCSVDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/upload">{t("dashboard.uploadCSVButton")}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t("dashboard.viewTickets")}
                </CardTitle>
                <CardDescription>{t("dashboard.viewTicketsDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full bg-transparent" variant="outline">
                  <Link href="/tickets">{t("dashboard.viewAllTickets")}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t("dashboard.reportsTitle")}
                </CardTitle>
                <CardDescription>{t("dashboard.reportsDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full bg-transparent" variant="outline">
                  <Link href="/reports">{t("dashboard.generateReports")}</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
