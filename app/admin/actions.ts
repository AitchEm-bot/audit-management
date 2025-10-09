"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function deleteUser(userId: string) {
  const supabase = await createClient()

  // Check if current user is admin
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: "Not authenticated" }
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single()

  if (!currentProfile || currentProfile.role !== "admin") {
    return { error: "Unauthorized - Admin access required" }
  }

  // Prevent admin from deleting themselves
  if (userId === currentUser.id) {
    return { error: "Cannot delete your own account" }
  }

  try {
    // Delete the user's profile
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId)

    if (profileError) {
      console.error("Error deleting user profile:", profileError)
      return { error: "Failed to delete user profile" }
    }

    // Note: Deleting from auth.users table requires admin privileges
    // This is typically done via Supabase Admin API or database triggers
    // For now, we're just deleting the profile

    revalidatePath("/admin")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteUser:", error)
    return { error: "An unexpected error occurred" }
  }
}
