"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState } from "react"

interface Profile {
  id: string
  full_name: string
  email: string
  department: string | null
  role: "emp" | "manager" | "exec" | "admin"
  created_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  hasRole: (roles: string | string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PROFILE_CACHE_KEY = 'user_profile_cache'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Load cached profile immediately
  useEffect(() => {
    try {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY)
      if (cached) {
        const cachedProfile = JSON.parse(cached)
        setProfile(cachedProfile)
      }
    } catch (err) {
      console.error("Failed to load cached profile:", err)
    }
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile fetch timeout after 5 seconds")), 5000)
      )

      const fetchPromise = supabase.from("profiles").select("*").eq("id", userId).single()

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any

      if (error) {
        console.error("useAuth: Error fetching profile:", error)
        return null
      }

      // Cache the profile
      if (data) {
        try {
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data))
        } catch (err) {
          console.error("Failed to cache profile:", err)
        }
      }

      return data
    } catch (err) {
      console.error("useAuth: Exception fetching profile:", err)
      return null
    }
  }

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  const hasRole = (roles: string | string[]) => {
    if (!profile) return false
    const roleArray = Array.isArray(roles) ? roles : [roles]
    return roleArray.includes(profile.role)
  }

  const signOut = async () => {
    // Clear local state and cache
    setUser(null)
    setProfile(null)
    try {
      localStorage.removeItem(PROFILE_CACHE_KEY)
    } catch (err) {
      console.error("Failed to clear profile cache:", err)
    }
  }

  useEffect(() => {
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id)
        setProfile(profileData)
      }

      setLoading(false)
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id)
        setProfile(profileData)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        refreshProfile,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
