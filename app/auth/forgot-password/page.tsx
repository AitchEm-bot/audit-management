"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { AuthLanguageToggle } from "@/components/auth-language-toggle"

export default function ForgotPasswordPage() {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error

      setMessage(locale === 'ar' ? "تحقق من بريدك الإلكتروني للحصول على رابط إعادة تعيين كلمة المرور" : "Check your email for a password reset link")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <AuthLanguageToggle />
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("auth.resetPassword")}</CardTitle>
              <CardDescription>{t("auth.resetPasswordDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t("auth.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  {message && <p className="text-sm text-green-500">{message}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t("common.loading") : t("auth.sendResetLink")}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  {t("auth.rememberPassword")}{" "}
                  <Link href="/auth/login" className="underline underline-offset-4">
                    {t("auth.login")}
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
