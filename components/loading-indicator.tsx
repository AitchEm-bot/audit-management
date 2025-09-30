"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export function LoadingIndicator() {
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setLoading(false)
  }, [pathname])

  useEffect(() => {
    const handleStart = () => setLoading(true)
    const handleComplete = () => setLoading(false)

    // Listen for route changes
    window.addEventListener('beforeunload', handleStart)

    return () => {
      window.removeEventListener('beforeunload', handleStart)
    }
  }, [])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4">
      <div className="bg-black/80 backdrop-blur-sm rounded-full p-3 shadow-lg">
        <div className="relative w-6 h-6">
          <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
          <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}