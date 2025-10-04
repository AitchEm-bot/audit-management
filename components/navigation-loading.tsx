"use client"

import { useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function NavigationLoading() {
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Reset loading state when route changes
    setIsNavigating(false)
  }, [pathname, searchParams])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    // Intercept link clicks to show loading
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      // Only trigger loading for actual anchor tags with href
      if (link && link.href && !link.href.startsWith('mailto:') && !link.href.startsWith('tel:')) {
        // Ignore blob URLs (file downloads) and data URLs
        if (link.href.startsWith('blob:') || link.href.startsWith('data:')) {
          return
        }

        // Ignore links with download attribute (downloads, not navigation)
        if (link.hasAttribute('download')) {
          return
        }

        const url = new URL(link.href)
        if (url.origin === window.location.origin && url.pathname !== pathname) {
          setIsNavigating(true)

          // Safety timeout: auto-hide spinner after 10 seconds if navigation didn't complete
          timeoutId = setTimeout(() => {
            setIsNavigating(false)
          }, 10000)
        }
      }
    }

    // Intercept form submissions to show loading
    const handleSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement
      if (form.method !== 'dialog') {
        setIsNavigating(true)

        // Safety timeout: auto-hide spinner after 10 seconds if navigation didn't complete
        timeoutId = setTimeout(() => {
          setIsNavigating(false)
        }, 10000)
      }
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('submit', handleSubmit)

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('submit', handleSubmit)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [pathname])

  if (!isNavigating) return null

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-black/90 backdrop-blur-sm rounded-full p-2 shadow-2xl">
        <div className="relative w-8 h-8 flex items-center justify-center">
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 rounded-full bg-white/10 animate-pulse"></div>

          {/* Spinning border */}
          <div className="absolute inset-0 rounded-full border-2 border-white/20"></div>
          <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>

          {/* Inner dot */}
          <div className="w-2 h-2 rounded-full bg-white"></div>
        </div>
      </div>
    </div>
  )
}