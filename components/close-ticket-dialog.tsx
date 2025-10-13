"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { closeTicketWithComment } from "@/app/tickets/[id]/actions"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"

interface CloseTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticketId: string
  commentCount?: number
}

export function CloseTicketDialog({
  open,
  onOpenChange,
  ticketId,
  commentCount: initialCommentCount,
}: CloseTicketDialogProps) {
  const router = useRouter()
  const { hasRole, profile } = useAuth()
  const [closingComment, setClosingComment] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commentCount, setCommentCount] = useState(initialCommentCount || 0)
  const [wasAIGenerated, setWasAIGenerated] = useState(false)

  // Check if user is an employee (needs approval)
  const isEmployee = hasRole('emp')

  // Log role detection
  useEffect(() => {
    console.log('🎭 [CloseDialog] Role check:', {
      isEmployee,
      profileRole: profile?.role,
      hasRoleEmp: hasRole('emp'),
      hasRoleManager: hasRole('manager'),
      hasRoleAdmin: hasRole('admin'),
      hasRoleExec: hasRole('exec')
    })
  }, [isEmployee, profile, hasRole])

  // Fetch actual comment count when dialog opens
  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setClosingComment("")
      setWasAIGenerated(false)
      setError(null)
      // Immediately enable the button (assume there are comments)
      setCommentCount(initialCommentCount || 1)

      const fetchCount = async () => {
        try {
          const supabase = createClient()

          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 3000)
          )

          const queryPromise = supabase
            .from("ticket_activities")
            .select("id")
            .eq("ticket_id", ticketId)
            .eq("activity_type", "comment")

          const result = await Promise.race([queryPromise, timeoutPromise]) as any

          if (!result.error && result.data) {
            console.log('✅ Dialog: Fetched comment count:', result.data.length)
            setCommentCount(result.data.length)
          }
        } catch (err) {
          console.log('⚠️ Dialog: Comment count fetch failed, using fallback')
          // Keep the fallback value (already set above)
        }
      }

      fetchCount()
    }
  }, [open, ticketId, initialCommentCount])

  const handleAISuggest = async () => {
    setIsGenerating(true)
    setError(null)
    setClosingComment('') // Clear existing text

    try {
      const response = await fetch('/api/summarize-thread', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticketId, stream: true }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to generate summary')
        if (data.summary) {
          setClosingComment(data.summary)
        }
        setIsGenerating(false)
        return
      }

      // Check for comment count in response headers
      const countHeader = response.headers.get('X-Comment-Count')
      if (countHeader) {
        const actualCount = parseInt(countHeader, 10)
        console.log('✅ Dialog: Got comment count from API:', actualCount)
        setCommentCount(actualCount)
      }

      // Read the stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          accumulatedText += chunk
          setClosingComment(accumulatedText)
        }
      }

      // Mark that AI was used to generate this comment
      setWasAIGenerated(true)
    } catch (err) {
      console.error('Error calling AI summarization:', err)
      setError('Failed to connect to AI service. Please write a closing comment manually.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClose = async () => {
    if (!closingComment.trim() || closingComment.trim().length < 10) {
      setError('Closing comment must be at least 10 characters')
      return
    }

    setIsSaving(true)
    setError(null)

    console.log('🚀 [CloseDialog] Starting closure process:', {
      isEmployee,
      ticketId,
      commentLength: closingComment.trim().length
    })

    try {
      // Employees must request closure, managers/admins/execs can close directly
      if (isEmployee) {
        console.log('👤 [CloseDialog] Employee detected - requesting manager approval')
        const supabase = createClient()
        const { data, error: rpcError } = await supabase.rpc('request_ticket_closure', {
          p_ticket_id: ticketId,
          p_closing_comment: closingComment.trim()
        })

        console.log('📞 [CloseDialog] RPC call result:', { data, rpcError })

        if (rpcError) {
          console.error('❌ [CloseDialog] Error requesting closure:', rpcError)
          setError(rpcError.message || 'Failed to request closure')
          setIsSaving(false)
          return
        }

        if (data?.error) {
          console.error('❌ [CloseDialog] Function returned error:', data.error)
          setError(data.error)
          setIsSaving(false)
          return
        }

        // Success - show message and refresh
        console.log('✅ [CloseDialog] Closure request successful')
        onOpenChange(false)
        router.push(`/tickets/${ticketId}?success=closureRequested`)
        router.refresh()
      } else {
        // Managers/Admins/Execs can close directly
        console.log('👨‍💼 [CloseDialog] Manager/Admin/Exec detected - closing directly')
        const result = await closeTicketWithComment(ticketId, closingComment.trim(), wasAIGenerated)

        console.log('📝 [CloseDialog] Direct close result:', result)

        if (result?.error) {
          console.error('❌ [CloseDialog] Error closing:', result.error)
          setError(result.error)
          setIsSaving(false)
        } else {
          // Success - close dialog and refresh
          console.log('✅ [CloseDialog] Ticket closed successfully')
          onOpenChange(false)
          router.refresh()
        }
      }
    } catch (err) {
      console.error('❌ [CloseDialog] Error closing ticket:', err)
      setError('Failed to close ticket. Please try again.')
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setClosingComment("")
    setWasAIGenerated(false)
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {isEmployee ? 'Request Ticket Closure' : 'Close Ticket'}
          </DialogTitle>
          <DialogDescription>
            {isEmployee
              ? 'Request manager approval to close this ticket. Please provide a summary of the resolution.'
              : 'Before closing this ticket, please provide a final summary of the resolution.'
            }
            {commentCount > 0 && ` You can use AI to summarize the ${commentCount} comment${commentCount === 1 ? '' : 's'} in this thread.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="closing-comment">Closing Comment *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAISuggest}
                disabled={isGenerating || isSaving || commentCount === 0}
                className="gap-2"
                title={commentCount === 0 ? "No comments to summarize" : `Summarize ${commentCount} comment${commentCount === 1 ? '' : 's'}`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    AI Suggest {commentCount > 0 && `(${commentCount})`}
                  </>
                )}
              </Button>
            </div>
            <Textarea
              id="closing-comment"
              placeholder="Summarize the resolution, key decisions, and final outcomes..."
              value={closingComment}
              onChange={(e) => {
                setClosingComment(e.target.value)
                // If user manually types, reset AI flag
                if (wasAIGenerated && e.target.value !== closingComment) {
                  setWasAIGenerated(false)
                }
              }}
              rows={6}
              disabled={isGenerating || isSaving}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This comment will be used in audit reports instead of individual thread comments.
              {closingComment.trim().length > 0 && ` (${closingComment.trim().length} characters)`}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isGenerating || isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleClose}
            disabled={isGenerating || isSaving || !closingComment.trim() || closingComment.trim().length < 10}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEmployee ? 'Requesting...' : 'Closing...'}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {isEmployee ? 'Request Closure' : 'Close Ticket'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}