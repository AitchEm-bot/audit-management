import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { filePath } = await request.json()

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Create signed URL with 1 hour expiry
    const { data, error } = await supabase
      .storage
      .from('ticket-attachments')
      .createSignedUrl(filePath, 3600)

    if (error) {
      console.error('[API] Error creating signed URL:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data?.signedUrl) {
      console.error('[API] No signed URL returned')
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (error) {
    console.error('[API] Exception in signed-url route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
