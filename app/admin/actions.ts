"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateUserProfile(
  userId: string,
  updates: {
    full_name?: string
    department?: string
    role?: string
    status?: string
  }
) {
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

  try {
    // Update profile table
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
      .select()
      .single()

    if (profileError) {
      console.error("Error updating profile:", profileError)
      return { error: "Failed to update profile" }
    }

    // Update auth.users metadata using RPC function
    const { data: metadataResult, error: metadataError } = await supabase.rpc(
      'admin_update_user_metadata',
      {
        target_user_id: userId,
        admin_user_id: currentUser.id,
        new_full_name: updates.full_name || null,
        new_department: updates.department || null,
        new_role: updates.role || null
      }
    )

    if (metadataError) {
      console.error("Error updating auth metadata:", metadataError)
      // Profile was updated but metadata sync failed - not critical
      console.warn("Profile updated but auth metadata sync failed")
    }

    console.log('✅ User profile updated successfully:', profileData)
    revalidatePath("/admin")
    revalidatePath(`/admin/users/${userId}`)
    return { success: true, data: profileData }
  } catch (error) {
    console.error("Error in updateUserProfile:", error)
    return { error: "An unexpected error occurred" }
  }
}

export async function approveUser(userId: string) {
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

  try {
    console.log('👍 Approving user:', userId)

    // Update user status to active and update timestamp
    const { data, error } = await supabase
      .from("profiles")
      .update({
        status: "active",
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
      .select()

    if (error) {
      console.error("❌ Error approving user:", error)
      return { error: "Failed to approve user" }
    }

    console.log('✅ User approved successfully:', data)
    revalidatePath("/admin")
    return { success: true }
  } catch (error) {
    console.error("❌ Error in approveUser:", error)
    return { error: "An unexpected error occurred" }
  }
}

export async function rejectUser(userId: string) {
  const supabase = await createClient()

  // Check if current user is admin
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: "Not authenticated" }
  }

  try {
    // First, get the user's email before deleting
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single()

    if (userProfile?.email) {
      // Store rejection record
      await supabase
        .from("rejected_registrations")
        .insert({
          email: userProfile.email,
          rejected_by: currentUser.id,
          reason: "Registration rejected by administrator"
        })
    }
    // Try using the admin_delete_user RPC function first
    const { data, error } = await supabase.rpc('admin_delete_user', {
      target_user_id: userId,
      admin_user_id: currentUser.id
    })

    if (error) {
      // If admin_delete_user doesn't exist, try simpler delete function
      console.log("Falling back to delete_user_completely function for rejection")

      const { data: deleteResult, error: deleteError } = await supabase.rpc(
        'delete_user_completely',
        { target_user_id: userId }
      )

      if (deleteError) {
        console.error("Error with fallback delete:", deleteError)

        // Last resort: delete from profiles (if CASCADE is set up)
        const { error: profileError } = await supabase
          .from("profiles")
          .delete()
          .eq("id", userId)

        if (profileError) {
          console.error("Error rejecting user:", profileError)
          return { error: "Failed to reject user" }
        }
      }
    } else if (data?.error) {
      return { error: data.error }
    }

    console.log('✅ User rejected and deleted successfully')
    revalidatePath("/admin")
    return { success: true }
  } catch (error) {
    console.error("Error in rejectUser:", error)
    return { error: "An unexpected error occurred" }
  }
}

export async function deleteUser(userId: string) {
  const supabase = await createClient()

  // Check if current user is admin
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: "Not authenticated" }
  }

  try {
    // Try using the admin_delete_user RPC function first
    const { data, error } = await supabase.rpc('admin_delete_user', {
      target_user_id: userId,
      admin_user_id: currentUser.id
    })

    if (error) {
      // If admin_delete_user doesn't exist, try simpler delete function
      console.log("Falling back to delete_user_completely function")

      const { data: deleteResult, error: deleteError } = await supabase.rpc(
        'delete_user_completely',
        { target_user_id: userId }
      )

      if (deleteError) {
        console.error("Error with fallback delete:", deleteError)

        // Last resort: delete from profiles (if CASCADE is set up)
        const { error: profileError } = await supabase
          .from("profiles")
          .delete()
          .eq("id", userId)

        if (profileError) {
          console.error("Error deleting profile:", profileError)
          return { error: "Failed to delete user" }
        }
      }
    } else if (data?.error) {
      return { error: data.error }
    }

    console.log('✅ User deleted successfully')
    revalidatePath("/admin")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteUser:", error)
    return { error: "An unexpected error occurred" }
  }
}
