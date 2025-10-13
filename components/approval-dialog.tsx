"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { useRouter } from "next/navigation"

interface ApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: {
    id: string
    ticket_number: string
    title: string
    resolution_comment: string
    requester_name: string
    approval_status?: string | null
  }
  onComplete?: () => void
}

export function ApprovalDialog({ open, onOpenChange, ticket, onComplete }: ApprovalDialogProps) {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const router = useRouter()
  const [comment, setComment] = useState("")
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if the request has already been processed
  const isAlreadyProcessed = ticket.approval_status === 'approved' || ticket.approval_status === 'rejected'

  const handleApprove = async () => {
    setProcessing(true)
    setError(null)

    try {
      const supabase = createClient()

      // Call the approve_ticket_closure function
      const { data, error: rpcError } = await supabase.rpc('approve_ticket_closure', {
        p_ticket_id: ticket.id,
        p_approved: true,
        p_approval_comment: comment || t("tickets.approvedWithoutComment")
      })

      if (rpcError) {
        console.error('Error approving closure:', rpcError)
        setError(rpcError.message || t("tickets.approvalFailed"))
        return
      }

      if (data?.error) {
        setError(data.error)
        return
      }

      // Success
      console.log('Closure approved successfully')
      onOpenChange(false)
      if (onComplete) onComplete()
      router.refresh()
    } catch (err) {
      console.error('Error approving closure:', err)
      setError(t("tickets.approvalFailed"))
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!comment.trim()) {
      setError(t("tickets.rejectionReasonRequired"))
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const supabase = createClient()

      // Call the approve_ticket_closure function with approved=false
      const { data, error: rpcError } = await supabase.rpc('approve_ticket_closure', {
        p_ticket_id: ticket.id,
        p_approved: false,
        p_approval_comment: comment
      })

      if (rpcError) {
        console.error('Error rejecting closure:', rpcError)
        setError(rpcError.message || t("tickets.rejectionFailed"))
        return
      }

      if (data?.error) {
        setError(data.error)
        return
      }

      // Success
      console.log('Closure rejected successfully')
      onOpenChange(false)
      if (onComplete) onComplete()
      router.refresh()
    } catch (err) {
      console.error('Error rejecting closure:', err)
      setError(t("tickets.rejectionFailed"))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("tickets.reviewClosureRequest")}</DialogTitle>
          <DialogDescription>
            {t("tickets.reviewClosureDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Ticket Info */}
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">{t("tickets.ticket")}:</span>{" "}
              <span className="font-mono">{ticket.ticket_number}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">{t("tickets.titleHeader")}:</span>{" "}
              {ticket.title}
            </div>
            <div className="text-sm">
              <span className="font-medium">{t("tickets.requestedBy")}:</span>{" "}
              {ticket.requester_name}
            </div>
          </div>

          {/* Employee's Closing Comment */}
          <div className="space-y-2">
            <Label>{t("tickets.employeeClosingComment")}</Label>
            <div className="p-3 bg-gray-50 rounded-md border text-sm whitespace-pre-wrap">
              {ticket.resolution_comment || t("tickets.noCommentProvided")}
            </div>
          </div>

          {/* Manager's Response */}
          <div className="space-y-2">
            <Label htmlFor="approval-comment">
              {t("tickets.yourResponse")} {t("common.optional")}
            </Label>
            <Textarea
              id="approval-comment"
              placeholder={t("tickets.approvalCommentPlaceholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {t("tickets.approvalCommentHint")}
            </p>
          </div>

          {/* Already Processed Warning */}
          {isAlreadyProcessed && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <div>
                <p className="font-medium">{t("tickets.alreadyProcessed")}</p>
                <p className="text-xs mt-1">
                  {ticket.approval_status === 'approved'
                    ? t("tickets.requestProcessedApproved")
                    : t("tickets.requestProcessedRejected")}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            {t("common.cancel")}
          </Button>
          {!isAlreadyProcessed && (
            <>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t("tickets.rejecting")}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    {t("tickets.rejectClosure")}
                  </>
                )}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t("tickets.approving")}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t("tickets.approveClosure")}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
