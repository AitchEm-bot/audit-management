"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { AuthLanguageToggle } from "@/components/auth-language-toggle"

export default function LoginPage() {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const messageParam = searchParams.get("message")
    if (messageParam) {
      setMessage(messageParam)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push("/dashboard")
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
              <CardTitle className="text-2xl">{t("auth.login")}</CardTitle>
              <CardDescription>{t("auth.signInSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
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
                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="password">{t("auth.password")}</Label>
                      <Link
                        href="/auth/forgot-password"
                        className={`${locale === 'ar' ? 'mr-auto' : 'ml-auto'} inline-block text-sm underline underline-offset-4`}
                      >
                        {t("auth.forgotPassword")}
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  {message && <p className="text-sm text-green-500">{message}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? `${t("common.loading")}` : t("auth.login")}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  {t("auth.dontHaveAccount")}{" "}
                  <Link href="/auth/sign-up" className="underline underline-offset-4">
                    {t("auth.signUp")}
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
