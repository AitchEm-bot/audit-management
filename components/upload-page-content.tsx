"use client"

import { CSVUpload } from "@/components/csv-upload"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"

export function UploadPageContent() {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t("upload.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("upload.subtitle")}
          </p>
        </div>

        <CSVUpload />
      </div>
    </div>
  )
}
