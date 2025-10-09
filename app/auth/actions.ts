"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/auth/login")
}

export async function checkProfileStatus(email: string) {
  const supabase = await createClient()

  try {
    // First check if email was rejected
    const { data: rejectionStatus } = await supabase
      .rpc('check_rejection_status', { user_email: email.toLowerCase() })
      .single()

    if (rejectionStatus?.is_rejected) {
      console.log('User was rejected:', rejectionStatus)
      return {
        exists: false,
        isVerified: false,
        isApproved: false,
        isRejected: true,
        rejectedAt: rejectionStatus.rejected_at,
        rejectionReason: rejectionStatus.reason
      }
    }
    // Use the RPC function to get profile with auth status
    const { data: profileWithAuth, error: rpcError } = await supabase
      .rpc('get_profile_with_auth_status', { user_email: email.toLowerCase() })
      .single()

    console.log('RPC query result:', {
      profileWithAuth,
      rpcError,
      hasEmailConfirmed: profileWithAuth?.email_confirmed_at,
      emailVerified: profileWithAuth?.email_verified
    })

    if (!rpcError && profileWithAuth) {
      // Successfully got profile with auth info via RPC
      const isVerified = profileWithAuth.email_verified === true ||
                        profileWithAuth.email_confirmed_at !== null

      console.log('Using RPC data:', {
        email_confirmed_at: profileWithAuth.email_confirmed_at,
        email_verified: profileWithAuth.email_verified,
        computed_verified: isVerified
      })

      return {
        profile: profileWithAuth,
        exists: true,
        isVerified: isVerified,
        isApproved: profileWithAuth.status === 'active',
        debugInfo: {
          source: 'rpc_function',
          email_confirmed_at: profileWithAuth.email_confirmed_at,
          email_verified: profileWithAuth.email_verified,
          raw_data: profileWithAuth
        }
      }
    }

    console.log('RPC failed with error:', rpcError?.message, '- falling back to profiles table')

    // Fallback to regular profiles table if view doesn't exist
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, status, role, created_at")
      .eq("email", email.toLowerCase())
      .single()

    if (error) {
      console.log('Error checking profile status:', error)

      // If no profile found, user hasn't signed up yet
      if (error.code === 'PGRST116') {
        return {
          exists: false,
          isVerified: false,
          isApproved: false
        }
      }

      return { error: error.message }
    }

    // Without the view, we can't know for sure if email is verified
    // But if profile exists, account was at least created
    return {
      profile,
      exists: !!profile,
      isVerified: false, // Conservative default - require the view for accurate status
      isApproved: profile?.status === 'active',
      debugInfo: {
        source: 'profiles_table_fallback',
        note: 'Cannot determine email verification without view'
      }
    }
  } catch (error) {
    console.error('Error in checkProfileStatus:', error)
    return { error: 'Failed to check profile status' }
  }
}