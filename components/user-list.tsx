"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { UserFilters } from "@/components/user-filters"
import { UserPagination } from "@/components/user-pagination"
import { DeleteUserDialog } from "@/components/delete-user-dialog"
import { deleteUser, approveUser, rejectUser } from "@/app/admin/actions"
import { useAuth } from "@/hooks/use-auth"
import { useState } from "react"
import { Check, X } from "lucide-react"

interface User {
  id: string
  full_name: string
  email: string
  department: string | null
  role: "emp" | "manager" | "exec" | "admin"
  status: "pending" | "active"
  created_at: string
}

const roleColors = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  exec: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  emp: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
}

interface UserListProps {
  users: User[]
  totalCount: number
  totalPages: number
  currentPage: number
  departments: string[]
}

export function UserList({ users, totalCount, totalPages, currentPage, departments }: UserListProps) {
  const router = useRouter()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const { profile: currentUserProfile } = useAuth()
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null)

  const handleRowClick = (userId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons or links
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) {
      return
    }
    setLoadingUserId(userId)
    router.push(`/admin/users/${userId}`)
  }

  const handleViewClick = (userId: string) => {
    setLoadingUserId(userId)
    router.push(`/admin/users/${userId}`)
  }

  const handleDelete = async (userId: string) => {
    const result = await deleteUser(userId)

    if (result?.error) {
      setMessage({ type: 'error', text: result.error })
      throw new Error(result.error)
    } else {
      // Refresh the page to show updated list
      router.refresh()
    }
  }

  const handleApprove = async (userId: string) => {
    setLoadingUserId(userId)
    const result = await approveUser(userId)
    setLoadingUserId(null)

    if (result?.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'User approved successfully' })
      router.refresh()
    }
  }

  const handleReject = async (userId: string) => {
    setLoadingUserId(userId)
    const result = await rejectUser(userId)
    setLoadingUserId(null)

    if (result?.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'User rejected successfully' })
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <UserFilters departments={departments} />
      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
          {message.text}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("users.title")}</CardTitle>
          <CardDescription>{t("users.cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("users.name")}</TableHead>
                  <TableHead>{t("users.email")}</TableHead>
                  <TableHead>{t("users.department")}</TableHead>
                  <TableHead>{t("users.role")}</TableHead>
                  <TableHead>{t("users.joinedAt")}</TableHead>
                  <TableHead>{t("users.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t("users.noUsers")}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={(e) => handleRowClick(user.id, e)}
                    >
                      <TableCell>
                        <Link href={`/admin/users/${user.id}`} className="block w-full hover:underline">
                          <div className="font-medium">{user.full_name}</div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/users/${user.id}`} className="block w-full">
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/users/${user.id}`} className="block w-full">
                          {user.department || "N/A"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/users/${user.id}`} className="block w-full">
                          <Badge className={roleColors[user.role as keyof typeof roleColors]}>
                            {t(`roles.${user.role}`)}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/users/${user.id}`} className="block w-full">
                          <span className="text-sm text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.status === 'pending' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleApprove(user.id)
                                }}
                                title="Accept"
                                className="cursor-pointer text-green-600 hover:text-white hover:bg-green-600"
                                disabled={loadingUserId === user.id}
                              >
                                {loadingUserId === user.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleReject(user.id)
                                }}
                                title="Reject"
                                className="cursor-pointer text-destructive hover:text-white hover:bg-destructive"
                                disabled={loadingUserId === user.id}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewClick(user.id)
                                }}
                                title={t("users.viewDetails")}
                                className="cursor-pointer"
                                disabled={loadingUserId === user.id}
                              >
                                {loadingUserId === user.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>

                              <div onClick={(e) => e.stopPropagation()}>
                                <DeleteUserDialog
                                  userName={user.full_name}
                                  onDelete={() => handleDelete(user.id)}
                                  disabled={currentUserProfile?.id === user.id || loadingUserId === user.id}
                                  iconOnly={true}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <UserPagination
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={currentPage}
      />
    </div>
  )
}
