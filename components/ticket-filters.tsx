"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { translateStatus, translatePriority, translateDepartment } from "@/lib/ticket-utils"

interface TicketFiltersProps {
  departments: string[]
}

export function TicketFilters({ departments }: TicketFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)

  // Get current values from URL
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "")

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    // Reset to page 1 when filters change
    params.delete("page")

    startTransition(() => {
      router.push(`/tickets?${params.toString()}`)
    })
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)

    // Debounce search
    const timer = setTimeout(() => {
      updateFilters("search", value)
    }, 300)

    return () => clearTimeout(timer)
  }

  const isRTL = locale === "ar"

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4`} />
          <Input
            placeholder={t("tickets.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={isRTL ? "pr-10" : "pl-10"}
            disabled={isPending}
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={searchParams.get("status") || "all"}
            onValueChange={(value) => updateFilters("status", value)}
            disabled={isPending}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder={t("tickets.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tickets.allStatus")}</SelectItem>
              <SelectItem value="active">{t("tickets.statusActive")}</SelectItem>
              <SelectItem value="open">{t("tickets.statusOpen")}</SelectItem>
              <SelectItem value="in_progress">{t("tickets.statusInProgress")}</SelectItem>
              <SelectItem value="pending">{t("tickets.statusPending")}</SelectItem>
              <SelectItem value="closed">{t("tickets.statusClosed")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={searchParams.get("priority") || "all"}
            onValueChange={(value) => updateFilters("priority", value)}
            disabled={isPending}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder={t("tickets.priority")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tickets.allPriority")}</SelectItem>
              <SelectItem value="low">{t("tickets.priorityLow")}</SelectItem>
              <SelectItem value="medium">{t("tickets.priorityMedium")}</SelectItem>
              <SelectItem value="high">{t("tickets.priorityHigh")}</SelectItem>
              <SelectItem value="critical">{t("tickets.priorityCritical")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={searchParams.get("department") || "all"}
            onValueChange={(value) => updateFilters("department", value)}
            disabled={isPending}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("tickets.department")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tickets.allDepartments")}</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {translateDepartment(dept, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}