import { spawn } from 'child_process'

export interface Ticket {
  id: string
  ticket_number: string
  title: string
  description: string
  status: string
  priority: string
  department: string
  resolution_comment: string | null
  due_date: string | null
  assigned_to: string | null
  assigned_profile?: {
    full_name: string
    email: string
  } | null
}

/**
 * AI Report Generator
 * Generates executive summaries and action plans for audit reports using Ollama
 */
export class AIReportGenerator {
  /**
   * Generate an executive summary from all findings
   * @param tickets - Array of tickets with closing comments
   * @returns Promise<string> - Executive summary text
   */
  static async generateExecutiveSummary(tickets: Ticket[]): Promise<string> {
    try {
      // Filter tickets that have closing comments
      const ticketsWithComments = tickets.filter(t => t.resolution_comment && t.resolution_comment.trim())

      if (ticketsWithComments.length === 0) {
        return "No findings with closing comments available for summary generation."
      }

      // Format findings for AI
      const findingsText = ticketsWithComments.map((ticket, index) => {
        return `Finding ${index + 1} [${ticket.priority.toUpperCase()}]: ${ticket.title}
Status: ${ticket.status}
Department: ${ticket.department}
Resolution: ${ticket.resolution_comment}`
      }).join('\n\n')

      // Create prompt for AI
      const prompt = `You are an audit report writer. Generate an executive summary for an audit report based on the following findings.

IMPORTANT INSTRUCTIONS:
- Write in third person from the company's perspective
- Do NOT use markdown formatting, asterisks (*), bullet points, or special characters
- Do NOT include headings like "Executive Summary:" or section headers
- Write 3-5 complete sentences in plain text only
- Focus on: overall assessment, key themes, critical findings, and general status
- Maintain a professional, formal audit report tone

Findings:
${findingsText}

Total Findings: ${ticketsWithComments.length}
Open: ${tickets.filter(t => t.status === 'open').length}
In Progress: ${tickets.filter(t => t.status === 'in_progress').length}
Closed: ${tickets.filter(t => t.status === 'closed').length}
Critical Priority: ${tickets.filter(t => t.priority === 'critical').length}
High Priority: ${tickets.filter(t => t.priority === 'high').length}

Write the executive summary now (plain text only, no formatting):`

      // Call Ollama and get response
      const summary = await this.callOllama(prompt)
      return summary.trim()

    } catch (error) {
      console.error('Error generating executive summary:', error)
      return "Executive summary generation unavailable. Please review individual findings below."
    }
  }

  /**
   * Generate an action plan for a specific ticket
   * @param ticket - Ticket to generate action plan for
   * @returns Promise<string> - Action plan text
   */
  static async generateActionPlan(ticket: Ticket): Promise<string> {
    try {
      if (!ticket.resolution_comment || !ticket.resolution_comment.trim()) {
        return "No action plan available - no closing comment provided."
      }

      const prompt = `You are an audit action plan specialist. Based on the following audit finding resolution, create a specific action plan.

IMPORTANT INSTRUCTIONS:
- Write in third person imperative form (action-oriented)
- Do NOT use markdown formatting, asterisks (*), bullet points, or special characters
- Do NOT include headings or section headers
- Write 2-3 complete sentences in plain text only
- Focus on: specific steps to be taken, responsible parties (if mentioned), and expected outcomes
- Keep it concise and action-oriented

Finding: ${ticket.title}
Department: ${ticket.department}
Priority: ${ticket.priority}
${ticket.assigned_profile ? `Assigned to: ${ticket.assigned_profile.full_name}` : ''}
${ticket.due_date ? `Target Date: ${ticket.due_date}` : ''}

Resolution/Closing Comment:
${ticket.resolution_comment}

Write the action plan now (plain text only, no formatting):`

      const actionPlan = await this.callOllama(prompt)
      return actionPlan.trim()

    } catch (error) {
      console.error('Error generating action plan:', error)
      return "Action plan generation unavailable."
    }
  }

  /**
   * Generate action plans for multiple tickets in parallel
   * @param tickets - Array of tickets
   * @returns Promise<Map<string, string>> - Map of ticket ID to action plan
   */
  static async generateActionPlans(tickets: Ticket[]): Promise<Map<string, string>> {
    const actionPlans = new Map<string, string>()

    // Generate action plans in parallel (limit concurrency to avoid overwhelming Ollama)
    const batchSize = 3
    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(async (ticket) => ({
          id: ticket.id,
          plan: await this.generateActionPlan(ticket)
        }))
      )

      results.forEach(result => {
        actionPlans.set(result.id, result.plan)
      })
    }

    return actionPlans
  }

  /**
   * Call Ollama to generate text
   * @param prompt - The prompt to send to Ollama
   * @returns Promise<string> - Generated text
   */
  private static async callOllama(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const ollama = spawn('ollama', ['run', 'gemma3'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      let errorOutput = ''

      ollama.stdin.write(prompt)
      ollama.stdin.end()

      ollama.stdout.on('data', (chunk) => {
        output += chunk.toString()
      })

      ollama.stderr.on('data', (chunk) => {
        errorOutput += chunk.toString()
      })

      ollama.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Ollama process exited with code ${code}: ${errorOutput}`))
          return
        }

        // Clean up the output
        const cleaned = output
          .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI escape codes
          .replace(/\[.*?\]/g, '') // Remove any bracketed content
          .trim()

        if (!cleaned) {
          reject(new Error('Ollama returned empty response'))
        } else {
          resolve(cleaned)
        }
      })

      ollama.on('error', (err) => {
        reject(new Error(`Ollama execution failed: ${err.message}`))
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        ollama.kill()
        reject(new Error('Ollama request timed out'))
      }, 30000)
    })
  }
}
