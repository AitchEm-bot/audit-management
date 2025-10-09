"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"

export default function SignUpSuccessPage() {
  const router = useRouter()
  const [emailVerified, setEmailVerified] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let userId: string | null = null
    let checkInterval: NodeJS.Timeout | null = null

    // Check initial auth state
    const checkAuthState = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        userId = user.id
        setEmailVerified(!!user.email_confirmed_at)

        // Check if user is approved
        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", user.id)
          .single()

        if (profile?.status === "active") {
          setIsApproved(true)
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            router.push("/dashboard")
          }, 2000)
          return true
        }
      }
      return false
    }

    // Initial check
    checkAuthState().then((approved) => {
      // If not yet approved, poll for status changes every 3 seconds
      if (!approved && userId) {
        checkInterval = setInterval(async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            setEmailVerified(!!user.email_confirmed_at)

            const { data: profile } = await supabase
              .from("profiles")
              .select("status")
              .eq("id", user.id)
              .single()

            if (profile?.status === "active") {
              setIsApproved(true)
              if (checkInterval) clearInterval(checkInterval)
              // Redirect to dashboard after 2 seconds
              setTimeout(() => {
                router.push("/dashboard")
              }, 2000)
            }
          }
        }, 3000) // Check every 3 seconds
      }
    })

    return () => {
      if (checkInterval) clearInterval(checkInterval)
    }
  }, [router, supabase])

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {isApproved ? "Account Approved!" : "Registration Submitted!"}
              </CardTitle>
              <CardDescription>
                {isApproved ? "Redirecting to dashboard..." : "Awaiting approval"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isApproved ? (
                  <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-950 p-4 rounded">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Your account has been approved!
                      </p>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      You will be redirected to the dashboard shortly...
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Thank you for signing up for the audit management system.
                    </p>

                    {emailVerified && (
                      <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-950 p-4 rounded">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            Email verified!
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-4 rounded">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                        {emailVerified ? "Waiting for approval:" : "Next Steps:"}
                      </p>
                      <ol className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-decimal list-inside">
                        {!emailVerified && (
                          <li>Check your email and verify your email address</li>
                        )}
                        <li>Wait for an administrator to approve your account</li>
                        <li>You will be automatically redirected once approved</li>
                      </ol>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {emailVerified
                        ? "Your email is verified. You will be able to sign in once an administrator approves your account."
                        : "Your account is pending email verification and admin approval. You will not be able to sign in until both steps are complete."
                      }
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
