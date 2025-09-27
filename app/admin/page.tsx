import { createClient } from "@/lib/supabase/server"
import { ProtectedRoute } from "@/components/protected-route"
import { UserManagement } from "@/components/user-management"
import { redirect } from "next/navigation"

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if user has admin role
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <ProtectedRoute requiredRoles={["admin"]}>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage users and system settings</p>
        </div>

        <UserManagement />
      </div>
    </ProtectedRoute>
  )
}
