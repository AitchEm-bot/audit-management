import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { UserDetailClient } from "@/components/user-detail-client"

interface UserPageProps {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: UserPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    redirect("/auth/login")
  }

  // Check if current user has admin role
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single()

  if (!currentProfile || currentProfile.role !== "admin") {
    redirect("/dashboard")
  }

  // Fetch user details
  let userProfile = null
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("Error fetching user:", error)
    } else {
      userProfile = data
    }
  } catch (error) {
    console.error("Server error fetching user:", error)
  }

  // If user not found, redirect to admin page
  if (!userProfile) {
    redirect("/admin")
  }

  return <UserDetailClient user={userProfile} />
}
