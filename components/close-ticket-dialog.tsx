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
  const [closingComment, setClosingComment] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commentCount, setCommentCount] = useState(initialCommentCount || 0)

  // Fetch actual comment count when dialog opens
  useEffect(() => {
    if (open) {
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

    try {
      const result = await closeTicketWithComment(ticketId, closingComment.trim())

      if (result?.error) {
        setError(result.error)
        setIsSaving(false)
      } else {
        // Success - close dialog and refresh
        onOpenChange(false)
        router.refresh()
      }
    } catch (err) {
      console.error('Error closing ticket:', err)
      setError('Failed to close ticket. Please try again.')
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setClosingComment("")
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Close Ticket
          </DialogTitle>
          <DialogDescription>
            Before closing this ticket, please provide a final summary of the resolution.
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
              onChange={(e) => setClosingComment(e.target.value)}
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
                Closing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Close Ticket
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}