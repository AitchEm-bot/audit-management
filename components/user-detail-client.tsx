"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { DeleteUserDialog } from "@/components/delete-user-dialog"
import { deleteUser } from "@/app/admin/actions"

interface User {
  id: string
  full_name: string
  email: string
  department: string | null
  role: "emp" | "manager" | "exec" | "admin"
  created_at: string
  updated_at: string
}

const roleColors = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  exec: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  emp: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
}

interface UserDetailClientProps {
  user: User
}

export function UserDetailClient({ user: initialUser }: UserDetailClientProps) {
  const router = useRouter()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const supabase = createClient()
  const { updateCachedProfile, profile: currentUserProfile } = useAuth()

  const [user, setUser] = useState(initialUser)
  const [formData, setFormData] = useState({
    full_name: user.full_name,
    department: user.department || "General",
    role: user.role,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleDelete = async () => {
    const result = await deleteUser(user.id)

    if (result?.error) {
      setMessage({ type: 'error', text: result.error })
      throw new Error(result.error)
    } else {
      // Redirect to admin page after successful deletion
      router.push("/admin")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          department: formData.department,
          role: formData.role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (error) {
        setMessage({ type: 'error', text: t("users.updateFailed") })
      } else {
        setMessage({ type: 'success', text: t("users.userUpdated") })

        // Update local state
        const updatedUser = {
          ...user,
          full_name: formData.full_name,
          department: formData.department,
          role: formData.role,
          updated_at: new Date().toISOString(),
        }
        setUser(updatedUser)

        // If admin is editing their own profile, update the cache to prevent UI flash
        if (currentUserProfile && currentUserProfile.id === user.id) {
          updateCachedProfile(updatedUser)
        }

        router.refresh()
      }
    } catch (error) {
      console.error("Error updating user:", error)
      setMessage({ type: 'error', text: t("users.updateFailed") })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("users.backToUsers")}
            </Button>
          </Link>
        </div>

        <div className="grid gap-6">
          {/* User Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{user.full_name}</CardTitle>
                  <CardDescription>{user.email}</CardDescription>
                </div>
                <Badge className={roleColors[user.role]}>
                  {t(`roles.${user.role}`)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("users.department")}:</span>
                  <p className="font-medium">{user.department || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("users.joinedAt")}:</span>
                  <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle>{t("users.editUser")}</CardTitle>
              <CardDescription>{t("users.updateUserInfo")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="full_name">{t("users.fullName")}</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("users.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    disabled
                    className="bg-gray-50 dark:bg-gray-900"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">{t("users.department")}</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(value) => setFormData({ ...formData, department: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IT">IT</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Legal">Legal</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">{t("users.role")}</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emp">{t("roles.emp")}</SelectItem>
                      <SelectItem value="manager">{t("roles.manager")}</SelectItem>
                      <SelectItem value="exec">{t("roles.exec")}</SelectItem>
                      <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {message && (
                  <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                    {message.text}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t("users.saving")}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {t("users.saveChanges")}
                      </>
                    )}
                  </Button>

                  <DeleteUserDialog
                    userName={user.full_name}
                    onDelete={handleDelete}
                    disabled={saving || currentUserProfile?.id === user.id}
                  />
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
