"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Brain, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

interface DepartmentSuggestionProps {
  title: string
  description: string
  onSuggestionAccepted?: (department: string) => void
  currentDepartment?: string
}

interface Suggestion {
  department: string
  confidence: number
  reasoning: string
  error?: string
}

export function DepartmentSuggestion({
  title,
  description,
  onSuggestionAccepted,
  currentDepartment,
}: DepartmentSuggestionProps) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSuggestion = async () => {
    if (!title.trim() || !description.trim()) {
      setError("Please provide both title and description")
      return
    }

    setLoading(true)
    setError(null)
    setSuggestion(null)

    try {
      const response = await fetch("/api/suggest-department", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get suggestion")
      }

      setSuggestion(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const acceptSuggestion = () => {
    if (suggestion && onSuggestionAccepted) {
      onSuggestionAccepted(suggestion.department)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800"
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High"
    if (confidence >= 0.6) return "Medium"
    return "Low"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Department Suggestion
        </CardTitle>
        <CardDescription>
          Use AI to automatically suggest the most appropriate department for this audit finding
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={getSuggestion} disabled={loading || !title.trim() || !description.trim()}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              Get AI Suggestion
            </>
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {suggestion && (
          <div className="space-y-4">
            {suggestion.error && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{suggestion.error}</AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Suggested Department:</span>
                  <Badge variant="outline">{suggestion.department}</Badge>
                </div>
                <Badge className={getConfidenceColor(suggestion.confidence)}>
                  {getConfidenceLabel(suggestion.confidence)} ({Math.round(suggestion.confidence * 100)}%)
                </Badge>
              </div>

              <div>
                <span className="font-medium text-sm">Reasoning:</span>
                <p className="text-sm text-muted-foreground mt-1">{suggestion.reasoning}</p>
              </div>

              {suggestion.department !== currentDepartment && onSuggestionAccepted && (
                <div className="flex gap-2 pt-2">
                  <Button onClick={acceptSuggestion} size="sm">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept Suggestion
                  </Button>
                </div>
              )}

              {suggestion.department === currentDepartment && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  This matches the current department assignment
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>
            <strong>Note:</strong> This feature requires Ollama to be running locally on port 11434. If Ollama is not
            available, the system will default to the "General" department.
          </p>
          <p className="mt-1">
            To set up Ollama: Install Ollama from{" "}
            <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="underline">
              ollama.ai
            </a>{" "}
            and run <code className="bg-muted px-1 rounded">ollama pull llama3.2</code>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
