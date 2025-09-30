'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(userId: string, updates: {
  full_name: string
  department: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.id !== userId) {
    return { error: 'Not authorized' }
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: updates.full_name,
        department: updates.department
      })
      .eq("id", userId)

    if (error) {
      console.error('Error updating profile:', error)
      return { error: 'Failed to update profile' }
    }

    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    console.error('Server error updating profile:', error)
    return { error: 'An unexpected error occurred' }
  }
}