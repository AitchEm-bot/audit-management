"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, XCircle, ExternalLink } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"
import { formatDate } from "@/lib/date-utils"
import { ApprovalDialog } from "@/components/approval-dialog"

interface PendingApproval {
  id: string
  ticket_number: string
  title: string
  department: string
  resolution_comment: string
  created_by: string
  created_at: string
  approval_status: string | null
  requester_name: string
  requester_email: string
}

interface PendingApprovalsCardProps {
  userRole?: string
  userDepartment?: string
}

export function PendingApprovalsCard({ userRole, userDepartment }: PendingApprovalsCardProps) {
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<PendingApproval | null>(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)

  // Log component state for debugging
  useEffect(() => {
    console.log('📋 [PendingApprovals] Component state:', {
      userRole,
      userDepartment,
      loading,
      approvalsCount: approvals.length,
      timestamp: new Date().toISOString()
    })
  }, [userRole, userDepartment, loading, approvals.length])

  useEffect(() => {
    // Only fetch if user is a manager
    if (userRole !== 'manager') {
      setLoading(false)
      return
    }

    fetchPendingApprovals()

    // Set up real-time subscription for pending approvals
    const supabase = createClient()
    const channel = supabase
      .channel('pending-approvals-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_tickets',
          filter: `requires_manager_approval=eq.true`
        },
        () => {
          console.log('Pending approval changed, refreshing...')
          fetchPendingApprovals()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userRole, userDepartment])

  // Only show for managers, but wait for role to load first
  if (userRole && userRole !== 'manager') {
    console.log('📋 [PendingApprovals] Not showing: user is not a manager', { userRole })
    return null
  }

  // Don't show anything if role hasn't loaded yet
  if (!userRole && !loading) {
    console.log('📋 [PendingApprovals] Not showing: no userRole and not loading', { userRole, loading })
    return null
  }

  console.log('📋 [PendingApprovals] Rendering component', {
    userRole,
    loading,
    approvalsLength: approvals.length,
    willShowCard: approvals.length > 0 || loading
  })

  const fetchPendingApprovals = async () => {
    setLoading(true)
    try {
      const supabase = createClient()

      // Use the pending_approvals view which already has the LEFT JOIN to profiles
      let query = supabase
        .from('pending_approvals')
        .select('*')

      // Filter by department (manager's department + General)
      if (userDepartment) {
        query = query.or(`department.eq.${userDepartment},department.eq.General`)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error} = await query

      if (error) {
        console.error('Error fetching pending approvals:', error)
        setApprovals([])
      } else {
        // The view already returns the data in the correct format
        setApprovals(data || [])
      }
    } catch (error) {
      console.error('Error fetching pending approvals:', error)
      setApprovals([])
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (approval: PendingApproval) => {
    setSelectedTicket(approval)
    setShowApprovalDialog(true)
  }

  const handleApprovalComplete = () => {
    setShowApprovalDialog(false)
    setSelectedTicket(null)
    fetchPendingApprovals()
  }

  if (loading) {
    console.log('📋 [PendingApprovals] Showing loading state')
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800 flex items-center gap-2">
            <Clock className="h-5 w-5 animate-pulse" />
            {t("tickets.approvalPending")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-blue-700">{t("common.loading")}</div>
        </CardContent>
      </Card>
    )
  }

  if (approvals.length === 0) {
    console.log('📋 [PendingApprovals] No approvals, hiding component')
    return null
  }

  console.log('📋 [PendingApprovals] Showing approvals card with', approvals.length, 'approvals')

  return (
    <>
      {/* Approval Dialog */}
      {selectedTicket && (
        <ApprovalDialog
          open={showApprovalDialog}
          onOpenChange={setShowApprovalDialog}
          ticket={selectedTicket}
          onComplete={handleApprovalComplete}
        />
      )}

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("tickets.approvalPending")} ({approvals.length})
          </CardTitle>
          <CardDescription className="text-blue-700">
            {t("tickets.pendingClosureRequests")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="bg-white rounded-lg p-4 border border-blue-200 space-y-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">
                      {approval.ticket_number}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {approval.department}
                    </Badge>
                  </div>
                  <h4 className="font-semibold text-sm">{approval.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {t("tickets.requestedBy")}: {approval.requester_name}
                  </p>
                  {approval.resolution_comment && (
                    <div className="mt-2 p-2 bg-gray-50 rounded border text-xs">
                      <span className="font-medium">{t("tickets.closingComment")}:</span>
                      <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                        {approval.resolution_comment}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(approval)}
                    className="whitespace-nowrap"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t("tickets.review")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                  >
                    <Link href={`/tickets/${approval.id}`}>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {t("common.view")}
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {t("tickets.requestedOn")}: {formatDate(approval.created_at, locale)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
