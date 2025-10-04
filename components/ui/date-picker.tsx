"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { ar } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useTranslation } from "@/lib/translations"

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  locale?: "en" | "ar"
  placeholder?: string
  disabled?: boolean
  className?: string
}

// Unicode RTL mark for forcing RTL text alignment
const RTL_MARK = '\u200F'

// Convert Arabic numerals to Latin numerals
function convertArabicNumerals(str: string): string {
  const arabicToLatin: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  }
  return str.replace(/[٠-٩]/g, (char) => arabicToLatin[char] || char)
}

// Format date input value with slashes
function formatDateInput(digits: string, isRTL: boolean = false): string {
  let formatted = ''

  if (isRTL) {
    // Arabic: User types DD/MM/YYYY, display as DD/MM/YYYY while typing
    // Only rearrange to YYYY/MM/DD when complete (8 digits)
    // digits stored as: DDMMYYYY

    if (digits.length === 8) {
      // Complete date - rearrange to YYYY/MM/DD
      const day = digits.slice(0, 2)
      const month = digits.slice(2, 4)
      const year = digits.slice(4, 8)
      formatted = year + '/' + month + '/' + day
    } else {
      // Incomplete - show as DD/MM/YYYY format (same as English)
      // Add day (max 2 digits)
      if (digits.length > 0) {
        formatted += digits.slice(0, 2)
      }

      // Add slash after day
      if (digits.length >= 2) {
        formatted += '/'
      }

      // Add month (max 2 digits)
      if (digits.length > 2) {
        formatted += digits.slice(2, 4)
      }

      // Add slash after month
      if (digits.length >= 4) {
        formatted += '/'
      }

      // Add year (max 4 digits)
      if (digits.length > 4) {
        formatted += digits.slice(4, 8)
      }
    }

    // Add RTL mark at the beginning for Arabic to force right-alignment
    if (formatted) {
      formatted = RTL_MARK + formatted
    }
  } else {
    // English: DD/MM/YYYY format
    // Add day (max 2 digits)
    if (digits.length > 0) {
      formatted += digits.slice(0, 2)
    }

    // Add slash after day
    if (digits.length >= 2) {
      formatted += '/'
    }

    // Add month (max 2 digits)
    if (digits.length > 2) {
      formatted += digits.slice(2, 4)
    }

    // Add slash after month
    if (digits.length >= 4) {
      formatted += '/'
    }

    // Add year (max 4 digits)
    if (digits.length > 4) {
      formatted += digits.slice(4, 8)
    }
  }

  return formatted
}

// Get cursor position after formatting
function getCursorPosition(prevDigits: string, newDigits: string, prevCursor: number, isRTL: boolean): number {
  const rtlOffset = isRTL ? 1 : 0 // Account for RTL mark at the beginning

  // For both English and Arabic during typing (incomplete), use same logic
  // Only when complete (8 digits) in Arabic, the display changes to YYYY/MM/DD

  if (isRTL && newDigits.length === 8) {
    // Complete date in Arabic - displayed as YYYY/MM/DD
    // Cursor should be at the end
    return 10 + rtlOffset // YYYY/MM/DD = 10 characters
  }

  // English or incomplete Arabic - both show DD/MM/YYYY format
  // Auto-jump after completing day (2 digits)
  if (newDigits.length === 2 && prevDigits.length === 1) {
    return 3 + rtlOffset // Jump to month position (after first /)
  }
  // Auto-jump after completing month (4 digits total)
  if (newDigits.length === 4 && prevDigits.length === 3) {
    return 6 + rtlOffset // Jump to year position (after second /)
  }

  // Calculate position based on number of slashes
  let position = newDigits.length
  if (newDigits.length > 2) position++ // Add 1 for first slash
  if (newDigits.length > 4) position++ // Add 1 for second slash

  return position + rtlOffset
}

export function DatePicker({
  value,
  onChange,
  locale = "en",
  placeholder,
  disabled = false,
  className,
}: DatePickerProps) {
  const { t } = useTranslation(locale)
  const isRTL = locale === "ar"
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [digits, setDigits] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Update input value when value prop changes
  React.useEffect(() => {
    if (value) {
      // Always store digits as DDMMYYYY
      const day = format(value, "dd")
      const month = format(value, "MM")
      const year = format(value, "yyyy")
      const digitsOnly = day + month + year // DDMMYYYY

      if (isRTL) {
        // Arabic: Display as YYYY/MM/DD
        const displayFormat = `${year}/${month}/${day}`
        setInputValue(RTL_MARK + displayFormat)
      } else {
        // English: Display as DD/MM/YYYY
        const displayFormat = `${day}/${month}/${year}`
        setInputValue(displayFormat)
      }

      setDigits(digitsOnly)
      setError(null)
    } else {
      setInputValue("")
      setDigits("")
      setError(null)
    }
  }, [value, isRTL])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const prevDigits = digits
    const prevCursor = e.target.selectionStart || 0

    // Convert Arabic numerals to Latin
    const normalizedValue = convertArabicNumerals(rawValue)

    // Extract only digits (this also removes the RTL mark)
    const newDigits = normalizedValue.replace(/\D/g, '').slice(0, 8)

    // Format the value with slashes and RTL mark if needed
    const formatted = formatDateInput(newDigits, isRTL)
    setInputValue(formatted)
    setDigits(newDigits)

    // Calculate new cursor position
    const newCursorPos = getCursorPosition(prevDigits, newDigits, prevCursor, isRTL)

    // Set cursor position after state update
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)

    // Try to parse and validate when 8 digits are entered
    if (newDigits.length === 8) {
      // Both English and Arabic: digits stored as DDMMYYYY
      const day = newDigits.slice(0, 2)
      const month = newDigits.slice(2, 4)
      const year = newDigits.slice(4, 8)
      const dateString = `${day}/${month}/${year}`
      const parseFormat = "dd/MM/yyyy"

      const parsedDate = parse(dateString, parseFormat, new Date())

      if (isValid(parsedDate)) {
        onChange?.(parsedDate)
        setError(null)
      } else {
        setError(t("datePicker.invalidDateFormat"))
      }
    } else {
      // Clear date if incomplete
      onChange?.(undefined)
      setError(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent entering non-digit characters (except special keys)
    if (!/[\d٠-٩]/.test(e.key) &&
        !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key) &&
        !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
    }
  }

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // If input is empty or we're clicking at the beginning, position cursor correctly
    if (digits.length === 0) {
      setTimeout(() => {
        if (inputRef.current) {
          const startPos = isRTL ? 1 : 0 // After RTL mark for Arabic, at 0 for English
          inputRef.current.setSelectionRange(startPos, startPos)
        }
      }, 0)
    }
  }

  const handleInputBlur = () => {
    if (digits.length > 0 && digits.length < 8) {
      // Incomplete date - clear it
      setInputValue("")
      setDigits("")
      onChange?.(undefined)
      setError(null)
    }
  }

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative">
          {/* Background placeholder - only visible when input is empty */}
          {!inputValue && (
            <div
              className={cn(
                "absolute inset-0 flex items-center pointer-events-none py-1 text-muted-foreground/40 text-base md:text-sm",
                isRTL ? "pl-10 text-right" : "pr-10 pl-3 text-left"
              )}
              style={isRTL ? { paddingRight: '0.75rem', direction: 'rtl' } : undefined}
            >
              {isRTL ? "YYYY/MM/DD" : "DD/MM/YYYY"}
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            disabled={disabled}
            style={isRTL ? { direction: 'rtl', textAlign: 'right', paddingRight: '0.75rem' } : undefined}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              error && "border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
              isRTL ? "pl-10" : "pr-10 pl-3 text-left",
              className
            )}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "absolute top-0 bottom-0 flex items-center justify-center w-10 hover:bg-accent rounded-md transition-colors",
                isRTL ? "left-0" : "right-0",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent
          className="w-auto p-0"
          align={isRTL ? "start" : "end"}
          side="bottom"
        >
          <div dir={isRTL ? "rtl" : "ltr"}>
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => {
                onChange?.(date)
                setOpen(false)
              }}
              captionLayout="dropdown"
              fromYear={1900}
              toYear={2100}
              initialFocus
              locale={locale === "ar" ? ar : undefined}
            />
          </div>
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
