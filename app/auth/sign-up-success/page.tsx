"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { checkProfileStatus } from "@/app/auth/actions"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { AuthLanguageToggle } from "@/components/auth-language-toggle"

export default function SignUpSuccessPage() {
  const router = useRouter()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const [emailVerified, setEmailVerified] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isRejected, setIsRejected] = useState(false)
  const supabase = createClient()
  const realtimeChannel = useRef<any>(null)

  // Function to check auth status (can be called manually or via polling)
  const checkAuthStatus = async () => {
    // Don't check if already rejected
    if (isRejected) {
      console.log('User already marked as rejected, skipping check')
      return
    }

    const signupEmail = localStorage.getItem('pending_signup_email')
    let crossDeviceHandled = false

    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      // Don't treat 403 as error - user just isn't authenticated yet
      if (error && error.message !== 'Auth session missing!') {
        console.log('Auth check error (expected if not verified yet):', error)
      }

      // For cross-device verification, use server action to bypass RLS
      if (signupEmail && !user) {
        crossDeviceHandled = true
        console.log('📱 Checking cross-device verification for:', signupEmail)

        try {
          // Use server action to check profile status (bypasses RLS)
          const result = await checkProfileStatus(signupEmail)

          console.log('Server action result:', result)

          if (result.error) {
            console.log('❌ Error checking profile status:', result.error)
          } else if (result.isRejected) {
            console.log('🚫 User was rejected by administrator')
            setIsRejected(true)
            setEmailVerified(false)
            setIsAuthenticated(false)
            setIsApproved(false)
            // Don't remove email yet - let user see the message first
          } else if (result.exists) {
            console.log('📊 Profile found by email (server action):', result.profile)

            // Update states based on server response
            console.log('📝 Setting states:', {
              emailVerified: result.isVerified,
              isAuthenticated: false,
              isApproved: result.isApproved
            })
            setEmailVerified(result.isVerified) // If profile exists, email was verified
            setIsAuthenticated(false) // But not authenticated on this device
            setIsApproved(result.isApproved)

            if (result.isApproved) {
              console.log('🎉 User approved (cross-device check)!')
              localStorage.removeItem('pending_signup_email')
            } else {
              console.log('⏳ User status:', result.profile?.status, '(cross-device check)')
            }
          } else {
            console.log('❓ No profile found for email:', signupEmail)
            // User hasn't verified email yet
            setEmailVerified(false)
            setIsAuthenticated(false)
            setIsApproved(false)
          }
        } catch (err) {
          console.error('Error calling server action:', err)
        }
      }

      if (user) {
        console.log('✅ User authenticated:', {
          email: user.email,
          emailConfirmed: user.email_confirmed_at,
        })

        setIsAuthenticated(true)
        setEmailVerified(!!user.email_confirmed_at)

        // Check if user is approved - Try different approaches
        console.log('🔍 Querying profile for user:', user.id)

        // First try: Direct query
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*") // Select all fields to see what we get
          .eq("id", user.id)
          .single()

        console.log('📊 Full profile query result:', {
          profile,
          profileError,
          allFields: profile ? Object.keys(profile) : [],
          status: profile?.status,
          isActive: profile?.status === "active"
        })

        if (profile?.status === "active") {
          console.log('🎉 User is active!')
          setIsApproved(true)
          localStorage.removeItem('pending_signup_email')
        } else if (profile?.status === "pending") {
          console.log('⏳ User status: pending (still waiting for approval)')
          setIsApproved(false)
        } else {
          console.log('❓ Unknown status:', profile?.status)
        }

        // Set up Realtime subscription for authenticated users (only once)
        if (!realtimeChannel.current && user) {
          console.log('🔔 Setting up Realtime subscription for authenticated user')
          realtimeChannel.current = supabase
            .channel(`profile-status-${user.id}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${user.id}`
              },
              (payload) => {
                console.log('✅ Profile change detected via Realtime:', payload)
                const updatedProfile = payload.new as any

                if (updatedProfile.status === 'active') {
                  console.log('🎉 User approved via Realtime!')
                  setIsApproved(true)
                  localStorage.removeItem('pending_signup_email')
                }
              }
            )
            .subscribe((status) => {
              console.log('Realtime subscription status:', status)
            })
        }
      } else if (!crossDeviceHandled) {
        // Only reset if we didn't handle cross-device verification
        // The cross-device check already set the states correctly
        console.log('⏳ User not authenticated yet, waiting for email verification...')
        // Don't reset states here - let the cross-device check handle it
      }
    } catch (err) {
      // Handle errors
      console.log('Auth check error:', err)
      setIsAuthenticated(false)
      setEmailVerified(false)
    } finally {
      // Cleanup if needed
    }
  }

  useEffect(() => {
    // Skip if already showing rejection
    if (isRejected) {
      return
    }

    // Get the email from localStorage (set during signup)
    const signupEmail = localStorage.getItem('pending_signup_email')
    console.log('📧 Monitoring email for approval:', signupEmail)

    if (!signupEmail) {
      // If no pending signup, redirect to login
      router.push('/auth/login')
      return
    }

    // Try to recover session from URL (after email verification)
    const handleSessionRecovery = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        console.log('🔐 Recovering session from email verification...')
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (!error) {
          console.log('✅ Session recovered successfully!')
          // Clear the hash to clean up URL
          window.location.hash = ''
        } else {
          console.error('❌ Session recovery failed:', error)
        }
      }

      // Initial check after potential session recovery
      checkAuthStatus()
    }

    handleSessionRecovery()

    // Check every 3 seconds for auth state changes (unless rejected)
    let authCheckInterval: NodeJS.Timeout | null = null

    if (!isRejected && !isApproved) {
      authCheckInterval = setInterval(checkAuthStatus, 3000)
    }

    return () => {
      if (authCheckInterval) {
        clearInterval(authCheckInterval)
      }
      if (realtimeChannel.current) {
        console.log('🔌 Unsubscribing from Realtime')
        realtimeChannel.current.unsubscribe()
        realtimeChannel.current = null
      }
    }
  }, [router, isRejected, isApproved]) // Add rejection state to dependencies

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <AuthLanguageToggle />
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {isRejected
                  ? (locale === 'ar' ? "تم رفض التسجيل" : "Registration Rejected")
                  : isApproved
                  ? (locale === 'ar' ? "تمت الموافقة على الحساب!" : "Account Approved!")
                  : (locale === 'ar' ? "تم إرسال التسجيل!" : "Registration Submitted!")}
              </CardTitle>
              <CardDescription>
                {isRejected
                  ? (locale === 'ar' ? "لم تتم الموافقة على طلبك" : "Your application was not approved")
                  : isApproved
                  ? (locale === 'ar' ? "حسابك جاهز" : "Your account is ready")
                  : (locale === 'ar' ? "في انتظار الموافقة" : "Awaiting approval")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Progress Timeline */}
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center gap-4">
                    {/* Step 1: Email Verification */}
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                        emailVerified
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      }`}>
                        {emailVerified ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <span className="text-lg font-semibold">1</span>
                        )}
                      </div>
                      <span className={`text-xs font-medium text-center max-w-[80px] ${
                        emailVerified
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-muted-foreground'
                      }`}>
                        {locale === 'ar' ? 'التحقق من البريد' : 'Email Verification'}
                      </span>
                    </div>

                    {/* Connecting Line */}
                    <div className={`w-16 h-1 transition-all duration-500 ${
                      emailVerified
                        ? 'bg-green-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}></div>

                    {/* Step 2: Admin Approval */}
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isApproved
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      }`}>
                        {isApproved ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <span className="text-lg font-semibold">2</span>
                        )}
                      </div>
                      <span className={`text-xs font-medium text-center max-w-[80px] ${
                        isApproved
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-muted-foreground'
                      }`}>
                        {locale === 'ar' ? 'موافقة المدير' : 'Admin Approval'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                {isRejected ? (
                  <>
                    <div className="border-l-4 border-red-500 bg-red-50 dark:bg-red-950 p-4 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          Registration Not Approved
                        </p>
                      </div>
                      <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                        Unfortunately, your registration was not approved by the administrator.
                        If you believe this is an error, please contact your system administrator.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            localStorage.removeItem('pending_signup_email')
                            router.push('/auth/login')
                          }}
                          className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
                        >
                          Back to Login
                        </button>
                        <button
                          onClick={() => {
                            localStorage.removeItem('pending_signup_email')
                            router.push('/auth/sign-up')
                          }}
                          className="flex-1 px-4 py-2 border border-gray-600 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  </>
                ) : isApproved ? (
                  <>
                    <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-950 p-4 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          Your account has been approved!
                        </p>
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                        Your account is ready! Please log in to access the system.
                      </p>
                      <button
                        onClick={() => router.push('/auth/login')}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                      >
                        Go to Login
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground text-center">
                      Thank you for signing up for the audit management system.
                    </p>

                    <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950 p-4 rounded">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        {emailVerified ? "Waiting for admin approval" : "Next Steps:"}
                      </p>
                      <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                        {!emailVerified && (
                          <li>Check your email and verify your email address</li>
                        )}
                        {emailVerified && !isApproved && (
                          <li>Wait for an administrator to approve your account</li>
                        )}
                        {!emailVerified && (
                          <li>Return to this page to see your approval status</li>
                        )}
                        <li>Log in once approved to access the dashboard</li>
                      </ol>
                    </div>

                    <p className="text-xs text-muted-foreground text-center italic">
                      This page automatically updates when your status changes.
                    </p>
                  </>
                )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
