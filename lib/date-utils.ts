import { format } from "date-fns"
import { ar } from "date-fns/locale"

export function formatDate(date: Date | string, locale: "en" | "ar" = "en"): string {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date

    if (locale === "ar") {
      // Format with Arabic locale
      return format(dateObj, "d MMMM yyyy", { locale: ar })
    }

    // Default English format
    return format(dateObj, "MMM dd, yyyy")
  } catch (error) {
    console.error("Error formatting date:", error)
    return "-"
  }
}

export function formatDateTime(date: Date | string, locale: "en" | "ar" = "en"): string {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date

    if (locale === "ar") {
      // Format with Arabic locale including time
      return format(dateObj, "d MMMM yyyy, HH:mm", { locale: ar })
    }

    // Default English format with time
    return format(dateObj, "MMM dd, yyyy, h:mm a")
  } catch (error) {
    console.error("Error formatting datetime:", error)
    return "-"
  }
}
