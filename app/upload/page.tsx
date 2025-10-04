import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { UploadPageContent } from "@/components/upload-page-content"

export default async function UploadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <UploadPageContent />
}
