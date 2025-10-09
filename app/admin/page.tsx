import { createClient } from "@/lib/supabase/server"
import { UserList } from "@/components/user-list"
import { redirect } from "next/navigation"

interface PageProps {
  searchParams?: Promise<{
    page?: string
    search?: string
    role?: string
    department?: string
  }>
}

export default async function AdminPage({ searchParams }: PageProps) {
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

  // Parse search params
  const params = await searchParams
  const page = parseInt(params?.page || "1", 10)
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Build filters
  const searchTerm = params?.search || undefined
  const roleFilter = params?.role && params.role !== "all" ? params.role : undefined
  const departmentFilter = params?.department && params.department !== "all" ? params.department : undefined

  // Fetch unique departments for filter dropdown
  const { data: deptData } = await supabase
    .from("profiles")
    .select("department")
    .not("department", "is", null)

  const departments = [...new Set(deptData?.map((item) => item.department) || [])]
    .filter(Boolean)
    .sort() as string[]

  // Build query with filters
  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })

  // Apply search filter (fuzzy name matching)
  if (searchTerm) {
    query = query.ilike("full_name", `%${searchTerm}%`)
  }

  // Apply role filter
  if (roleFilter) {
    query = query.eq("role", roleFilter)
  }

  // Apply department filter
  if (departmentFilter) {
    query = query.eq("department", departmentFilter)
  }

  // Apply sorting: pending users first (status DESC makes 'pending' come before 'active'), then by created_at
  query = query
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to)

  const { data: users, error, count } = await query

  if (error) {
    console.error("Error fetching users:", error)
  }

  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  console.log(`Fetched ${users?.length || 0} users (page ${page}, total: ${totalCount})`)
  console.log("Users data sample:", users?.map(u => ({ id: u.id, name: u.full_name, status: u.status })))

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-7xl mx-auto">
        <UserList
          users={users || []}
          totalCount={totalCount}
          totalPages={totalPages}
          currentPage={page}
          departments={departments}
        />
      </div>
    </div>
  )
}
