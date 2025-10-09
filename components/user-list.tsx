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
import { useState, useEffect } from "react"
import { Check, X, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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
  const supabase = createClient()

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
      setMessage({ type: 'success', text: 'User deleted successfully' })
      // Auto-dismiss message after 5 seconds
      setTimeout(() => setMessage(null), 5000)
      // Refresh the page to show updated list
      router.refresh()
    }
  }

  const handleApprove = async (userId: string) => {
    console.log('👍 Approving user:', userId)
    setLoadingUserId(userId)
    const result = await approveUser(userId)
    setLoadingUserId(null)

    console.log('Approve result:', result)

    if (result?.error) {
      setMessage({ type: 'error', text: result.error })
      // Auto-dismiss error after 10 seconds
      setTimeout(() => setMessage(null), 10000)
    } else {
      setMessage({ type: 'success', text: 'User approved successfully' })
      // Auto-dismiss success after 5 seconds
      setTimeout(() => setMessage(null), 5000)
      console.log('✅ User approved, refreshing page...')
      router.refresh()
    }
  }

  const handleReject = async (userId: string) => {
    setLoadingUserId(userId)
    const result = await rejectUser(userId)
    setLoadingUserId(null)

    if (result?.error) {
      setMessage({ type: 'error', text: result.error })
      // Auto-dismiss error after 10 seconds
      setTimeout(() => setMessage(null), 10000)
    } else {
      setMessage({ type: 'success', text: 'User rejected and removed successfully' })
      // Auto-dismiss success after 5 seconds
      setTimeout(() => setMessage(null), 5000)
      router.refresh()
    }
  }

  // Subscribe to realtime changes on profiles table
  useEffect(() => {
    const channel = supabase
      .channel('admin-profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('🔔 Admin panel: Profile change detected:', payload.eventType)
          console.log('Profile details:', {
            email: payload.new?.email || payload.old?.email,
            status: payload.new?.status || payload.old?.status,
            eventType: payload.eventType
          })
          // Refresh the page to get updated data
          router.refresh()
        }
      )
      .subscribe((status) => {
        console.log('🔔 Admin panel Realtime status:', status)
      })

    return () => {
      channel.unsubscribe()
    }
  }, [router, supabase])

  return (
    <div className="space-y-6">
      <UserFilters departments={departments} />
      {message && (
        <div className={`p-4 rounded-md flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800'
            : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <span className="font-medium">{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="ml-auto p-1 hover:opacity-70 transition-opacity"
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
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
