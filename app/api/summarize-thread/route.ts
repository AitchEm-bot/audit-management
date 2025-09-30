import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { spawn } from 'child_process'

export async function POST(request: NextRequest) {
  console.log('🚀 [API] /api/summarize-thread - POST request received')

  try {
    console.log('🔍 [API] Creating Supabase client...')
    const supabase = await createClient()

    // Check authentication
    console.log('🔐 [API] Checking authentication...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ticketId, stream = false } = await request.json()

    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 })
    }

    // Fetch all comments for this ticket
    console.log('📝 [API] Fetching comments for ticket:', ticketId)
    const { data: activities, error: activitiesError } = await supabase
      .from('ticket_activities')
      .select('id, content, created_at, user_id')
      .eq('ticket_id', ticketId)
      .eq('activity_type', 'comment')
      .order('created_at', { ascending: true })

    console.log('📊 [API] Query result:', {
      count: activities?.length,
      error: activitiesError,
      hasActivities: !!activities
    })

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }

    if (!activities || activities.length === 0) {
      return NextResponse.json({
        error: 'No comments found for this ticket',
        summary: 'No discussion history available. Please add a closing comment manually.'
      }, { status: 400 })
    }

    // Fetch user profiles separately
    console.log('👥 [API] Fetching user profiles...')
    const userIds = [...new Set(activities.map(a => a.user_id).filter(Boolean))]
    let profileMap = new Map()

    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      console.log('📊 [API] Profiles result:', {
        count: profiles?.length,
        error: profileError
      })

      if (!profileError && profiles) {
        profileMap = new Map(profiles.map(p => [p.id, p]))
      }
    }

    // Format the thread for the AI
    const threadText = activities.map((activity, index) => {
      const profile = profileMap.get(activity.user_id)
      const author = profile?.full_name || 'Unknown User'
      const content = activity.content || ''
      const date = new Date(activity.created_at).toLocaleDateString()
      return `[${date}] ${author}: ${content}`
    }).join('\n\n')

    console.log('📝 [API] Formatted thread text length:', threadText.length)

    // Prepare the prompt for Ollama
    const prompt = `You are an audit assistant. Summarize the following ticket discussion thread into a concise closing statement for audit records.

IMPORTANT INSTRUCTIONS:
- Write in third person from the company's perspective using "we" or "the company"
- Do NOT use markdown formatting, asterisks (*), or bullet points
- Do NOT include headings like "Closing Statement:" or section headers
- Write 2-4 complete sentences in plain text only
- Focus on: key decisions made, resolutions implemented, final outcomes, and important notes

Discussion Thread:
${threadText}

Write the closing statement now (plain text only, no formatting):`

    // Call Ollama to generate summary
    try {
      console.log('🤖 [API] Calling Ollama with gemma3...')
      console.log('🔧 [API] Stream mode:', stream)

      if (stream) {
        // Streaming response
        const encoder = new TextEncoder()
        const readable = new ReadableStream({
          async start(controller) {
            const ollama = spawn('ollama', ['run', 'gemma3'], {
              stdio: ['pipe', 'pipe', 'pipe']
            })

            // Write the prompt to stdin
            ollama.stdin.write(prompt)
            ollama.stdin.end()

            // Stream stdout
            ollama.stdout.on('data', (chunk) => {
              const text = chunk.toString()
              // Remove ANSI escape codes
              const cleaned = text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\[.*?\]/g, '')
              if (cleaned.trim()) {
                controller.enqueue(encoder.encode(cleaned))
              }
            })

            ollama.on('close', (code) => {
              console.log('✅ [API] Ollama streaming completed with code:', code)
              controller.close()
            })

            ollama.on('error', (err) => {
              console.error('❌ [API] Ollama error:', err)
              controller.error(err)
            })
          }
        })

        return new NextResponse(readable, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'X-Comment-Count': activities.length.toString(),
          },
        })
      } else {
        // Non-streaming response (keep for backwards compatibility)
        return new Promise((resolve, reject) => {
          const ollama = spawn('ollama', ['run', 'gemma3'], {
            stdio: ['pipe', 'pipe', 'pipe']
          })

          let output = ''

          ollama.stdin.write(prompt)
          ollama.stdin.end()

          ollama.stdout.on('data', (chunk) => {
            output += chunk.toString()
          })

          ollama.on('close', (code) => {
            console.log('✅ [API] Ollama completed with code:', code)

            // Clean up the output
            const summary = output
              .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
              .replace(/\[.*?\]/g, '')
              .trim()

            if (!summary) {
              resolve(NextResponse.json({
                error: 'AI failed to generate summary',
                summary: 'Failed to generate summary. Please write a closing comment manually.'
              }, { status: 500 }))
            } else {
              resolve(NextResponse.json({
                success: true,
                summary: summary,
                commentCount: activities.length
              }))
            }
          })

          ollama.on('error', (err) => {
            console.error('❌ [API] Ollama error:', err)
            resolve(NextResponse.json({
              error: 'AI service unavailable',
              summary: 'AI summarization service is currently unavailable. Please write a closing comment manually.'
            }, { status: 503 }))
          })
        })
      }

    } catch (ollamaError) {
      console.error('Ollama execution error:', ollamaError)
      return NextResponse.json({
        error: 'AI service unavailable',
        summary: 'AI summarization service is currently unavailable. Please write a closing comment manually.'
      }, { status: 503 })
    }

  } catch (error) {
    console.error('Unexpected error in summarize-thread:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 })
  }
}