import { type NextRequest, NextResponse } from "next/server"
import { ollama } from "@/lib/ollama"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, description } = body

    console.log("Department suggestion request:", { title: title?.substring(0, 50), description: description?.substring(0, 50) })

    if (!title?.trim() || !description?.trim()) {
      console.warn("Department suggestion rejected: missing or empty title/description")
      return NextResponse.json({
        error: "Title and description are required and cannot be empty",
        department: "General",
        confidence: 0.1
      }, { status: 400 })
    }

    // Check if Ollama is available
    const isOllamaAvailable = await ollama.isAvailable()

    if (!isOllamaAvailable) {
      return NextResponse.json({
        department: "General",
        confidence: 0.1,
        reasoning: "Ollama service is not available. Please ensure Ollama is running on localhost:11434",
        error: "Ollama service unavailable",
      })
    }

    // Get department suggestion from Ollama
    const suggestion = await ollama.generateDepartmentSuggestion(title, description)

    return NextResponse.json(suggestion)
  } catch (error) {
    console.error("Department suggestion error:", error)
    return NextResponse.json(
      {
        department: "General",
        confidence: 0.1,
        reasoning: "Error occurred while processing request",
        error: "Internal server error",
      },
      { status: 500 },
    )
  }
}
