"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { LanguageToggle } from "@/components/language-toggle"
import { User, Settings, LogOut, Shield } from "lucide-react"
import Link from "next/link"
import { signOut as serverSignOut } from "@/app/auth/actions"

export function Navigation() {
  const { user, profile, hasRole } = useAuth()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)

  const handleSignOut = async () => {
    // Directly call server action - it will handle everything and redirect
    await serverSignOut()
  }

  if (!user) {
    return null
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-xl font-bold">
              {t("common.auditManagement")}
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              <Link href="/dashboard" className="text-sm font-medium hover:text-primary">
                {t("common.dashboard")}
              </Link>
              <Link href="/tickets" className="text-sm font-medium hover:text-primary">
                {t("common.tickets")}
              </Link>
              <Link href="/upload" className="text-sm font-medium hover:text-primary">
                {t("common.upload")}
              </Link>
              <Link href="/reports" className="text-sm font-medium hover:text-primary">
                {t("common.reports")}
              </Link>
              {hasRole("admin") && (
                <Link href="/admin" className="text-sm font-medium hover:text-primary">
                  {t("common.admin")}
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {profile && (
              <div className="hidden md:flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">{profile.full_name}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    profile.role === "admin"
                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : profile.role === "exec"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                        : profile.role === "manager"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                  }`}
                >
                  {t(`roles.${profile.role}`)}
                </span>
              </div>
            )}

            <LanguageToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.full_name || user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("common.profileSettings")}
                  </Link>
                </DropdownMenuItem>
                {hasRole("admin") && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      {t("common.adminPanel")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("common.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}
