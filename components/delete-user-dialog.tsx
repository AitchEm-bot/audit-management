"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"

interface DeleteUserDialogProps {
  userName: string
  onDelete: () => Promise<void>
  disabled?: boolean
  iconOnly?: boolean
}

export function DeleteUserDialog({ userName, onDelete, disabled, iconOnly = false }: DeleteUserDialogProps) {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const CONFIRM_TEXT = locale === "ar" ? "تأكيد الحذف" : "confirm delete"
  const isConfirmValid = confirmText.toLowerCase() === CONFIRM_TEXT.toLowerCase()

  const handleDelete = async () => {
    if (!isConfirmValid) return

    setIsDeleting(true)
    try {
      await onDelete()
      setOpen(false)
      setConfirmText("")
    } catch (error) {
      console.error("Error deleting user:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setConfirmText("")
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        {iconOnly ? (
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            title={t("users.deleteUser")}
            className="text-destructive data-[state=open]:bg-destructive data-[state=open]:text-white"
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = 'hsl(0 84.2% 60.2%)'
                e.currentTarget.style.color = 'white'
                e.currentTarget.style.cursor = 'pointer'
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = ''
                e.currentTarget.style.color = ''
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="destructive" size="sm" disabled={disabled}>
            <Trash2 className={`h-4 w-4 ${locale === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {t("users.deleteUser")}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className={locale === 'ar' ? 'rtl' : 'ltr'}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("users.deleteUserTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              {locale === 'ar'
                ? `هل أنت متأكد من حذف حساب ${userName}؟ سيؤدي هذا إلى إزالة جميع بياناتهم من النظام بشكل دائم.`
                : `Are you sure you want to delete ${userName}'s account? This will permanently remove all their data from the system.`}
            </p>
            <p className="font-semibold text-destructive">
              {t("users.cannotUndo")}
            </p>
            <div className="space-y-2 pt-4">
              <Label htmlFor="confirm-text">
                {locale === 'ar'
                  ? <>للتأكيد، اكتب <code className="bg-muted px-2 py-1 rounded text-sm" dir="ltr">{CONFIRM_TEXT}</code></>
                  : <>To confirm, type <code className="bg-muted px-2 py-1 rounded text-sm">confirm delete</code></>}
              </Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={locale === 'ar' ? `اكتب '${CONFIRM_TEXT}' للمتابعة` : "Type 'confirm delete' to proceed"}
                autoComplete="off"
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={locale === 'ar' ? 'flex-row-reverse gap-2' : ''}>
          <AlertDialogCancel disabled={isDeleting}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={!isConfirmValid || isDeleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <div className={`animate-spin rounded-full h-4 w-4 border-b-2 border-white ${locale === 'ar' ? 'ml-2' : 'mr-2'}`}></div>
                <span className="text-white">{t("users.deleting")}</span>
              </>
            ) : (
              <span className="text-white">{t("users.deleteUser")}</span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
