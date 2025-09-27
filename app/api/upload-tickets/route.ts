import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    console.log("Server-side ticket upload started")

    // Verify authentication
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    console.log("User authentication:", {
      isAuthenticated: !!user,
      userId: user?.id
    })

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tickets } = await request.json()

    if (!tickets || !Array.isArray(tickets)) {
      return NextResponse.json({ error: "Invalid tickets data" }, { status: 400 })
    }

    console.log(`Received ${tickets.length} tickets for insertion`)

    // Add user ID and ticket numbers to each ticket
    const ticketsToInsert = tickets.map((ticket: any, index: number) => ({
      title: ticket.title,
      description: ticket.description,
      department: ticket.department?.substring(0, 99) || "General", // Truncate for VARCHAR(100)
      priority: ticket.priority,
      status: ticket.status,
      due_date: ticket.due_date,
      ticket_number: `AUDIT-${Date.now()}-${index + 1}`,
      created_by: user.id,
    }))

    console.log("Sample ticket to insert:", ticketsToInsert[0])

    // Test table access first
    console.log("Testing table access...")
    const { data: testData, error: testError } = await supabase
      .from("audit_tickets")
      .select("id")
      .limit(1)

    if (testError) {
      console.error("Table access error:", testError)
      return NextResponse.json({
        error: "Database table access failed",
        details: testError.message
      }, { status: 500 })
    }

    console.log("Table access successful, proceeding with insertion...")

    // Insert tickets to database
    const { data, error: insertError } = await supabase
      .from("audit_tickets")
      .insert(ticketsToInsert)
      .select()

    if (insertError) {
      console.error("Database insertion error:", insertError)
      return NextResponse.json({
        error: "Database insertion failed",
        details: insertError.message,
        code: insertError.code
      }, { status: 500 })
    }

    console.log(`Successfully inserted ${data.length} tickets`)

    return NextResponse.json({
      success: true,
      insertedCount: data.length,
      tickets: data
    })

  } catch (error) {
    console.error("Server-side upload error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}