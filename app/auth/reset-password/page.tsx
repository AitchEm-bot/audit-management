"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordStrengthIndicator } from "@/components/password-strength-indicator"
import { validatePassword } from "@/lib/password-validation"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { AuthLanguageToggle } from "@/components/auth-language-toggle"

export default function ResetPasswordPage() {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if we have the required tokens from the URL
    const accessToken = searchParams.get("access_token")
    const refreshToken = searchParams.get("refresh_token")

    if (!accessToken || !refreshToken) {
      setError(locale === 'ar' ? "رابط إعادة التعيين غير صالح. يرجى طلب إعادة تعيين كلمة مرور جديدة." : "Invalid reset link. Please request a new password reset.")
    }
  }, [searchParams, locale])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join(", "))
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError(locale === 'ar' ? "كلمات المرور غير متطابقة" : "Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      const message = locale === 'ar' ? "تم تحديث كلمة المرور بنجاح" : "Password updated successfully"
      router.push(`/auth/login?message=${encodeURIComponent(message)}`)
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
              <CardTitle className="text-2xl">{t("auth.setNewPassword")}</CardTitle>
              <CardDescription>{t("auth.enterNewPassword")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="password">{t("auth.newPassword")}</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <PasswordStrengthIndicator password={password} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">{t("auth.confirmNewPassword")}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    {confirmPassword && (
                      <p className={`text-xs ${password === confirmPassword ? "text-green-500" : "text-red-500"}`}>
                        {password === confirmPassword
                          ? locale === 'ar' ? "✓ كلمات المرور متطابقة" : "✓ Passwords match"
                          : locale === 'ar' ? "✗ كلمات المرور غير متطابقة" : "✗ Passwords do not match"}
                      </p>
                    )}
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t("common.loading") : t("auth.updatePassword")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
