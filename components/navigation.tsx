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
import { User, Settings, LogOut, Shield } from "lucide-react"
import Link from "next/link"
import { signOut as serverSignOut } from "@/app/auth/actions"

export function Navigation() {
  const { user, profile, hasRole, signOut: clientSignOut } = useAuth()

  const handleSignOut = async () => {
    // First clear client-side state
    await clientSignOut()
    // Then call server action to clear server-side session and redirect
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
              Audit Management
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              <Link href="/dashboard" className="text-sm font-medium hover:text-primary">
                Dashboard
              </Link>
              <Link href="/tickets" className="text-sm font-medium hover:text-primary">
                Tickets
              </Link>
              <Link href="/upload" className="text-sm font-medium hover:text-primary">
                Upload
              </Link>
              <Link href="/reports" className="text-sm font-medium hover:text-primary">
                Reports
              </Link>
              {hasRole("admin") && (
                <Link href="/admin" className="text-sm font-medium hover:text-primary">
                  Admin
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
                      ? "bg-red-100 text-red-800"
                      : profile.role === "manager"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {profile.role}
                </span>
              </div>
            )}

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
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                {hasRole("admin") && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}
