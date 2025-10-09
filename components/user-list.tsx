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

interface User {
  id: string
  full_name: string
  email: string
  department: string | null
  role: "emp" | "manager" | "exec" | "admin"
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

  const handleRowClick = (userId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons or links
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) {
      return
    }
    router.push(`/admin/users/${userId}`)
  }

  return (
    <div className="space-y-6">
      <UserFilters departments={departments} />
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/admin/users/${user.id}`)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {t("users.viewDetails")}
                        </Button>
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
