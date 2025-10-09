"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { getDepartmentLabel } from "@/lib/departments"

interface UserFiltersProps {
  departments: string[]
}

export function UserFilters({ departments }: UserFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)

  // Get current values from URL
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "")

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value && value !== "all") {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    // Reset to page 1 when filters change
    params.delete("page")

    startTransition(() => {
      router.push(`/admin?${params.toString()}`)
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
            placeholder={t("users.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={isRTL ? "pr-10" : "pl-10"}
            disabled={isPending}
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={searchParams.get("role") || "all"}
            onValueChange={(value) => updateFilters("role", value)}
            disabled={isPending}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("users.role")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("users.allRoles")}</SelectItem>
              <SelectItem value="emp">{t("roles.emp")}</SelectItem>
              <SelectItem value="manager">{t("roles.manager")}</SelectItem>
              <SelectItem value="exec">{t("roles.exec")}</SelectItem>
              <SelectItem value="admin">{t("roles.admin")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={searchParams.get("department") || "all"}
            onValueChange={(value) => updateFilters("department", value)}
            disabled={isPending}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("users.department")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("users.allDepartments")}</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {getDepartmentLabel(dept, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
