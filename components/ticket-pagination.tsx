"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface TicketPaginationProps {
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize?: number
}

export function TicketPagination({ totalCount, totalPages, currentPage, pageSize = 20 }: TicketPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const navigateToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", page.toString())
    router.push(`/tickets?${params.toString()}`)
  }

  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-center mt-4">
        <div className="text-sm text-muted-foreground">
          Showing {totalCount} {totalCount === 1 ? "ticket" : "tickets"}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-muted-foreground">
        Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)} to{" "}
        {Math.min(currentPage * pageSize, totalCount)} of {totalCount} tickets
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateToPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
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
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}