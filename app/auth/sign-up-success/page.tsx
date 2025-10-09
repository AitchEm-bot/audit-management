import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Registration Submitted!</CardTitle>
              <CardDescription>Awaiting approval</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Thank you for signing up for the audit management system.
                </p>
                <div className="border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-4 rounded">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    Next Steps:
                  </p>
                  <ol className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-decimal list-inside">
                    <li>Check your email and verify your email address</li>
                    <li>Wait for an administrator to approve your account</li>
                    <li>You will receive an email notification once approved</li>
                  </ol>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your account is pending admin approval. You will not be able to sign in until an administrator reviews and approves your registration.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
