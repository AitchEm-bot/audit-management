"use client"

import type React from "react"

import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
  fallbackPath?: string
}

export function ProtectedRoute({ children, requiredRoles = [], fallbackPath = "/auth/login" }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push(fallbackPath)
        return
      }

      if (requiredRoles.length > 0 && profile) {
        const hasRequiredRole = requiredRoles.includes(profile.role)
        if (!hasRequiredRole) {
          router.push("/dashboard") // Redirect to dashboard if no permission
          return
        }
      }
    }
  }, [user, profile, loading, router, requiredRoles, fallbackPath])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (requiredRoles.length > 0 && profile && !requiredRoles.includes(profile.role)) {
    return null
  }

  return <>{children}</>
}
