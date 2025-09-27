import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error("Supabase credentials missing:", {
      url: url ? "present" : "missing",
      key: key ? "present" : "missing"
    })
  }

  return createBrowserClient(url!, key!)
}
