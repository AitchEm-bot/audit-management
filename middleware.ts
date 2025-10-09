import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  supabaseResponse.headers.set("X-Frame-Options", "DENY")
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff")
  supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  supabaseResponse.headers.set("X-XSS-Protection", "1; mode=block")

  // Extract the domain from the Supabase URL for WebSocket connections
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseDomain = supabaseUrl.replace('https://', '')

  supabaseResponse.headers.set(
    "Content-Security-Policy",
    `default-src 'self' ${supabaseUrl}; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ${supabaseUrl} wss://${supabaseDomain}`,
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const protectedRoutes = ["/dashboard", "/tickets", "/upload", "/reports", "/profile"]
  const adminRoutes = ["/admin"]
  const authRoutes = ["/auth/login", "/auth/sign-up", "/auth/forgot-password", "/auth/reset-password"]
  const signupSuccessRoute = "/auth/sign-up-success"

  const isProtectedRoute = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))
  const isAdminRoute = adminRoutes.some((route) => request.nextUrl.pathname.startsWith(route))
  const isAuthRoute = authRoutes.some((route) => request.nextUrl.pathname.startsWith(route))
  const isSignupSuccessRoute = request.nextUrl.pathname.startsWith(signupSuccessRoute)

  // Redirect unauthenticated users to login
  if (!user && (isProtectedRoute || isAdminRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Check user status for authenticated users
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, role")
      .eq("id", user.id)
      .single()

    // Block pending users from accessing protected routes (except sign-up-success page)
    if (profile?.status === "pending" && (isProtectedRoute || isAdminRoute)) {
      const url = request.nextUrl.clone()
      url.pathname = signupSuccessRoute
      return NextResponse.redirect(url)
    }

    // Redirect active users away from sign-up-success page ONLY if they have no pending signup
    // This allows users to see their approval on the page before being redirected
    if (profile?.status === "active" && isSignupSuccessRoute) {
      // Check if they still have a pending signup in localStorage (browser-side check)
      // Since middleware runs server-side, we can't check localStorage here
      // So we only redirect if they navigate to the page directly (not coming from email verification)
      const referer = request.headers.get('referer')
      const isFromEmailVerification = referer && referer.includes('auth/sign-up-success')

      if (!isFromEmailVerification) {
        const url = request.nextUrl.clone()
        url.pathname = "/dashboard"
        return NextResponse.redirect(url)
      }
    }

    // Redirect authenticated active users away from auth pages
    if (profile?.status === "active" && isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }

    // Check admin access for admin routes
    if (isAdminRoute && profile?.role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
