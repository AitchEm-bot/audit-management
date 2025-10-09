"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"

interface Profile {
  id: string
  full_name: string
  email: string
  department: string | null
  role: "emp" | "manager" | "exec" | "admin"
  created_at: string
}

export function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const { hasRole } = useAuth()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const supabase = createClient()

  const fetchUsers = async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching users:", error)
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId)

    if (error) {
      console.error("Error updating user role:", error)
    } else {
      fetchUsers() // Refresh the list
    }
  }

  useEffect(() => {
    if (hasRole("admin")) {
      fetchUsers()
    }
  }, [hasRole])

  if (!hasRole("admin")) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">You don't have permission to access this page.</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "exec":
        return "default"
      case "manager":
        return "default"
      case "emp":
        return "secondary"
      default:
        return "outline"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage user roles and permissions</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.department || "N/A"}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(user.role)}>{t(`roles.${user.role}`)}</Badge>
                </TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Select value={user.role} onValueChange={(newRole) => updateUserRole(user.id, newRole)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emp">{t("roles.emp")}</SelectItem>
                      <SelectItem value="manager">{t("roles.manager")}</SelectItem>
                      <SelectItem value="exec">{t("roles.exec")}</SelectItem>
                      <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
