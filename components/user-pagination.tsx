"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"

interface UserPaginationProps {
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize?: number
}

export function UserPagination({ totalCount, totalPages, currentPage, pageSize = 20 }: UserPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)

  const navigateToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", page.toString())
    router.push(`/admin?${params.toString()}`)
  }

  const userWord = totalCount === 1 ? t("users.userSingular") : t("users.userPlural")

  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-center mt-4">
        <div className="text-sm text-muted-foreground">
          {t("users.showing", {
            start: totalCount.toString(),
            end: totalCount.toString(),
            total: `${totalCount} ${userWord}`
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-muted-foreground">
        {t("users.showing", {
          start: Math.min((currentPage - 1) * pageSize + 1, totalCount).toString(),
          end: Math.min(currentPage * pageSize, totalCount).toString(),
          total: `${totalCount} ${userWord}`
        })}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateToPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          {t("common.previous")}
        </Button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = currentPage <= 3 ? i + 1 : currentPage + i - 2
            if (pageNum > 0 && pageNum <= totalPages) {
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => navigateToPage(pageNum)}
                  className="w-10"
                >
                  {pageNum}
                </Button>
              )
            }
            return null
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateToPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          {t("common.next")}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
