"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PasswordStrengthIndicator } from "@/components/password-strength-indicator"
import { validatePassword } from "@/lib/password-validation"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { AuthLanguageToggle } from "@/components/auth-language-toggle"

export default function SignUpPage() {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [department, setDepartment] = useState("")
  const [role, setRole] = useState("emp")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Department translations
  const departments = [
    { value: "IT", label: locale === 'ar' ? "تقنية المعلومات" : "IT" },
    { value: "Finance", label: locale === 'ar' ? "المالية" : "Finance" },
    { value: "HR", label: locale === 'ar' ? "الموارد البشرية" : "HR" },
    { value: "Operations", label: locale === 'ar' ? "العمليات" : "Operations" },
    { value: "Legal", label: locale === 'ar' ? "القانونية" : "Legal" },
    { value: "Compliance", label: locale === 'ar' ? "الامتثال" : "Compliance" },
    { value: "Marketing", label: locale === 'ar' ? "التسويق" : "Marketing" },
    { value: "Sales", label: locale === 'ar' ? "المبيعات" : "Sales" },
    { value: "General", label: locale === 'ar' ? "عام" : "General" }
  ]

  // Role translations
  const roles = [
    { value: "emp", label: t("roles.employee") || "Employee" },
    { value: "manager", label: t("roles.manager") || "Manager" },
    { value: "exec", label: t("roles.executive") || "Executive" }
  ]

  const handleSignUp = async (e: React.FormEvent) => {
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
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/sign-up-success#`,
          data: {
            full_name: fullName,
            department: department,
            role: role,
            status: 'pending', // New users start as pending
          },
        },
      })
      if (error) throw error

      // Store email in localStorage (lowercase to match database normalization)
      localStorage.setItem('pending_signup_email', email.toLowerCase())

      router.push("/auth/sign-up-success")
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
              <CardTitle className="text-2xl">{t("auth.signUp")}</CardTitle>
              <CardDescription>{t("auth.createAccount")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">{t("users.fullName")}</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder={locale === 'ar' ? "الاسم الكامل" : "John Doe"}
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="department">{t("users.department")}</Label>
                    <Select
                      value={department}
                      onValueChange={setDepartment}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={locale === 'ar' ? "اختر القسم" : "Select your department"} />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.value} value={dept.value}>
                            {dept.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">{t("users.role")}</Label>
                    <Select
                      value={role}
                      onValueChange={setRole}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={locale === 'ar' ? "اختر الدور" : "Select your role"} />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <Label htmlFor="password">{t("auth.password")}</Label>
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
                    <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
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
                    {isLoading ? t("auth.creatingAccount") : t("auth.signUp")}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  {t("auth.alreadyHaveAccount")}{" "}
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
