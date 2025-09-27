interface OllamaResponse {
  model: string
  created_at: string
  response: string
  done: boolean
}

interface DepartmentSuggestion {
  department: string
  confidence: number
  reasoning: string
}

export class OllamaService {
  private baseUrl: string
  private model: string

  constructor(baseUrl = "http://localhost:11434", model = "llama3.2") {
    this.baseUrl = baseUrl
    this.model = model
  }

  async generateDepartmentSuggestion(title: string, description: string): Promise<DepartmentSuggestion> {
    const prompt = `
You are an AI assistant that helps assign audit findings to the appropriate department. 

Based on the following audit finding, suggest the most appropriate department and provide your reasoning.

Available departments:
- IT (Information Technology, cybersecurity, software, hardware, networks)
- Finance (accounting, budgeting, financial controls, procurement)
- HR (Human Resources, personnel, training, compliance)
- Operations (business processes, workflow, efficiency)
- Legal (compliance, contracts, regulatory)
- Marketing (advertising, communications, brand)
- Sales (revenue, customer relations, sales processes)
- General (items that don't fit other categories)

Audit Finding:
Title: ${title}
Description: ${description}

Respond with ONLY a JSON object in this exact format:
{
  "department": "department_name",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this department was chosen"
}
`

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`)
      }

      const data: OllamaResponse = await response.json()

      // Parse the JSON response from the LLM
      try {
        const suggestion = JSON.parse(data.response.trim())

        // Validate the response structure
        if (!suggestion.department || typeof suggestion.confidence !== "number" || !suggestion.reasoning) {
          throw new Error("Invalid response format from LLM")
        }

        return {
          department: suggestion.department,
          confidence: Math.min(Math.max(suggestion.confidence, 0), 1), // Clamp between 0 and 1
          reasoning: suggestion.reasoning,
        }
      } catch (parseError) {
        console.error("Failed to parse LLM response:", data.response)
        // Fallback to General department
        return {
          department: "General",
          confidence: 0.1,
          reasoning: "Failed to parse LLM response, defaulting to General department",
        }
      }
    } catch (error) {
      console.error("Ollama API error:", error)
      // Fallback when Ollama is not available
      return {
        department: "General",
        confidence: 0.1,
        reasoning: "Ollama service unavailable, defaulting to General department",
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

export const ollama = new OllamaService()
