"use client"

import { Button } from "@/components/ui/button"
import { Globe } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

export function AuthLanguageToggle() {
  const { locale, setLocale } = useLanguage()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === "en" ? "ar" : "en")}
      className="absolute top-4 right-4 rtl:left-4 rtl:right-auto gap-2"
    >
      <Globe className="h-4 w-4" />
      <span>{locale === "en" ? "العربية" : "English"}</span>
    </Button>
  )
}