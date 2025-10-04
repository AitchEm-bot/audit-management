"use client"

import { TicketList } from "@/components/ticket-list"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"

interface TicketsPageContentProps {
  tickets: any[]
  departments: any[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export function TicketsPageContent({
  tickets,
  departments,
  totalCount,
  totalPages,
  currentPage,
}: TicketsPageContentProps) {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t("tickets.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("tickets.subtitle")}</p>
        </div>

        <TicketList
          tickets={tickets}
          departments={departments}
          totalCount={totalCount}
          totalPages={totalPages}
          currentPage={currentPage}
        />
      </div>
    </div>
  )
}
