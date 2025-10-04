"use client"

import * as React from "react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  locale?: "en" | "ar"
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  locale = "en",
  placeholder,
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const isRTL = locale === "ar"

  const formatDateValue = (date: Date | undefined) => {
    if (!date) return undefined

    if (locale === "ar") {
      return format(date, "d MMMM yyyy", { locale: ar })
    }
    return format(date, "PPP")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
          {value ? formatDateValue(value) : <span>{placeholder || (locale === "ar" ? "اختر تاريخ" : "Pick a date")}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align={isRTL ? "end" : "start"}
        side="bottom"
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date)
            setOpen(false)
          }}
          initialFocus
          locale={locale === "ar" ? ar : undefined}
          dir={isRTL ? "rtl" : "ltr"}
        />
      </PopoverContent>
    </Popover>
  )
}
