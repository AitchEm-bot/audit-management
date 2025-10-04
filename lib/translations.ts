import en from "@/locales/en.json"
import ar from "@/locales/ar.json"

const translations = {
  en,
  ar,
} as const

export type Locale = keyof typeof translations
export type TranslationKeys = typeof en

export function getTranslations(locale: Locale): TranslationKeys {
  return translations[locale] || translations.en
}

// Helper function to get nested translation
export function getNestedTranslation(
  translations: any,
  key: string
): string {
  const keys = key.split(".")
  let value = translations

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k]
    } else {
      return key // Return key if not found
    }
  }

  return typeof value === "string" ? value : key
}

// Hook-like function to get translation function
export function useTranslation(locale: Locale) {
  const t = getTranslations(locale)

  return {
    t: (key: string, params?: Record<string, string | number>) => {
      let translation = getNestedTranslation(t, key)

      // Replace parameters in translation
      if (params) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          translation = translation.replace(`{${paramKey}}`, String(paramValue))
        })
      }

      return translation
    },
    translations: t,
  }
}
