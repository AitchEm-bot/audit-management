import { format } from 'date-fns'

// Server-side only: PDFKit is externalized in next.config
// This avoids webpack bundling issues
function getPDFDocument() {
  if (typeof window !== 'undefined') {
    throw new Error('PDF generation is only available server-side')
  }

  // Direct require since PDFKit is externalized in webpack config
  return require('pdfkit')
}

export interface PdfTicket {
  id: string
  ticket_number: string
  title: string
  description: string | null
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
  created_at: string
  audit_comments?: any[]
}

export interface PdfOptions {
  groupBy: 'none' | 'department' | 'priority' | 'status'
  samaFields: {
    includeFindingDescription: boolean
    includeRiskLevel: boolean
    includeManagementResponse: boolean
    includeActionPlan: boolean
    includeResponsibleParty: boolean
    includeTargetDate: boolean
  }
  includeAllComments: boolean
  locale: 'en' | 'ar'
}

export interface PdfGenerationData {
  tickets: PdfTicket[]
  executiveSummary: string
  actionPlans: Map<string, string>
  options: PdfOptions
  filters?: {
    status?: string[]
    priority?: string[]
    department?: string[]
    dateRange?: { start: string; end: string }
  }
}

/**
 * PDF Report Generator for Audit Replies
 * Generates professional PDF reports following SAMA audit structure
 */
export class PdfReportGenerator {
  private doc: any
  private pageNumber: number = 1
  private isRTL: boolean

  private readonly MARGIN = 50
  private readonly PAGE_WIDTH = 595 // A4 width in points
  private readonly PAGE_HEIGHT = 842 // A4 height in points
  private readonly CONTENT_WIDTH = this.PAGE_WIDTH - 2 * this.MARGIN

  constructor(locale: 'en' | 'ar' = 'en') {
    const PDFDocument = getPDFDocument()
    this.doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 70,
        left: 50,
        right: 50
      },
      bufferPages: true
    })
    this.isRTL = locale === 'ar'
  }

  /**
   * Generate complete PDF report
   */
  async generate(data: PdfGenerationData): Promise<Buffer> {
    // Generate cover page
    this.generateCoverPage(data)

    // Add executive summary
    this.doc.addPage()
    this.generateExecutiveSummary(data.executiveSummary, data.tickets)

    // Add findings
    this.doc.addPage()
    this.generateFindingsSection(data)

    // Add page numbers to all pages
    this.addPageNumbers()

    // Finalize PDF
    this.doc.end()

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      this.doc.on('data', (chunk) => chunks.push(chunk))
      this.doc.on('end', () => resolve(Buffer.concat(chunks)))
      this.doc.on('error', reject)
    })
  }

  /**
   * Generate cover page
   */
  private generateCoverPage(data: PdfGenerationData): void {
    const centerX = this.PAGE_WIDTH / 2

    // Logo placeholder (you can add actual logo later)
    this.doc
      .rect(centerX - 75, 150, 150, 100)
      .lineWidth(2)
      .stroke('#cccccc')

    this.doc
      .fontSize(12)
      .fillColor('#666666')
      .text('[Organization Logo]', centerX - 75, 180, {
        width: 150,
        align: 'center'
      })

    // Title
    this.doc
      .moveDown(3)
      .fontSize(28)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Audit Findings Report', 50, 300, {
        width: this.CONTENT_WIDTH,
        align: 'center'
      })

    // Organization name placeholder
    this.doc
      .moveDown(2)
      .fontSize(18)
      .fillColor('#333333')
      .font('Helvetica')
      .text('[Organization Name]', {
        width: this.CONTENT_WIDTH,
        align: 'center'
      })

    // Generation date
    const dateStr = format(new Date(), 'MMMM dd, yyyy')
    this.doc
      .moveDown(4)
      .fontSize(14)
      .fillColor('#666666')
      .text(`Generated on ${dateStr}`, {
        width: this.CONTENT_WIDTH,
        align: 'center'
      })

    // Filter summary
    if (data.filters) {
      this.doc.moveDown(4)
      this.doc
        .fontSize(12)
        .fillColor('#333333')
        .font('Helvetica-Bold')
        .text('Report Filters:', {
          width: this.CONTENT_WIDTH,
          align: 'center'
        })

      const filters = []
      if (data.filters.status && data.filters.status.length > 0) {
        filters.push(`Status: ${data.filters.status.join(', ')}`)
      }
      if (data.filters.priority && data.filters.priority.length > 0) {
        filters.push(`Priority: ${data.filters.priority.join(', ')}`)
      }
      if (data.filters.department && data.filters.department.length > 0) {
        filters.push(`Department: ${data.filters.department.join(', ')}`)
      }
      if (data.filters.dateRange) {
        filters.push(`Date Range: ${data.filters.dateRange.start} to ${data.filters.dateRange.end}`)
      }

      this.doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#666666')
        .moveDown(0.5)

      filters.forEach(filter => {
        this.doc.text(filter, {
          width: this.CONTENT_WIDTH,
          align: 'center'
        })
      })
    }

    // Footer
    this.doc
      .fontSize(10)
      .fillColor('#999999')
      .text(
        'Confidential - For Internal Use Only',
        50,
        this.PAGE_HEIGHT - 100,
        {
          width: this.CONTENT_WIDTH,
          align: 'center'
        }
      )
  }

  /**
   * Generate executive summary section
   */
  private generateExecutiveSummary(summary: string, tickets: PdfTicket[]): void {
    // Section header
    this.addSectionHeader('Executive Summary')

    // Statistics
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      pending: tickets.filter(t => t.status === 'pending').length,
      closed: tickets.filter(t => t.status === 'closed').length,
      critical: tickets.filter(t => t.priority === 'critical').length,
      high: tickets.filter(t => t.priority === 'high').length
    }

    this.doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#333333')
      .text(`Total Findings: ${stats.total}`, { continued: false })
      .moveDown(0.3)
      .text(`Open: ${stats.open} | In Progress: ${stats.inProgress} | Pending: ${stats.pending} | Closed: ${stats.closed}`)
      .moveDown(0.3)
      .text(`Critical: ${stats.critical} | High Priority: ${stats.high}`)
      .moveDown(1.5)

    // Summary text
    this.doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#000000')
      .text(summary, {
        width: this.CONTENT_WIDTH,
        align: 'justify',
        lineGap: 4
      })
  }

  /**
   * Generate findings section with grouping
   */
  private generateFindingsSection(data: PdfGenerationData): void {
    this.addSectionHeader('Audit Findings')

    const grouped = this.groupTickets(data.tickets, data.options.groupBy)

    Object.entries(grouped).forEach(([groupName, tickets], index) => {
      if (index > 0) {
        this.doc.moveDown(2)
      }

      // Group header (if grouped)
      if (data.options.groupBy !== 'none') {
        this.doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#1a56db')
          .text(this.formatGroupName(groupName, data.options.groupBy), {
            underline: true
          })
          .moveDown(1)
      }

      // Generate each finding
      tickets.forEach((ticket, ticketIndex) => {
        if (ticketIndex > 0) {
          this.doc.moveDown(1.5)
        }
        this.generateFinding(ticket, data.options, data.actionPlans.get(ticket.id) || '')
      })
    })
  }

  /**
   * Generate a single finding
   */
  private generateFinding(ticket: PdfTicket, options: PdfOptions, actionPlan: string): void {
    // Let PDFKit handle page breaks automatically - it will create new pages when text overflows
    // Manual page breaks were causing empty pages to appear

    // Finding number and title
    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(`${ticket.ticket_number}: ${ticket.title}`, {
        width: this.CONTENT_WIDTH
      })
      .moveDown(0.5)

    // Status badge
    const statusColor = this.getStatusColor(ticket.status)
    this.doc
      .fontSize(10)
      .fillColor(statusColor)
      .text(`Status: ${ticket.status.toUpperCase()}`, {
        continued: true
      })
      .fillColor('#666666')
      .text(`  |  Priority: ${ticket.priority}`)
      .moveDown(0.8)

    // Finding Description (optional)
    if (options.samaFields.includeFindingDescription && ticket.description) {
      this.addFieldSection('Finding Description', ticket.description)
    }

    // Risk Level (optional)
    if (options.samaFields.includeRiskLevel) {
      this.addFieldSection('Risk Level', this.getRiskLevel(ticket.priority))
    }

    // Management Response (optional) - Only closing comment
    if (options.samaFields.includeManagementResponse && ticket.resolution_comment) {
      this.addFieldSection('Management Response', ticket.resolution_comment)
    }

    // Action Plan (optional) - AI generated
    if (options.samaFields.includeActionPlan && actionPlan) {
      this.addFieldSection('Action Plan', actionPlan)
    }

    // Responsible Party (optional)
    if (options.samaFields.includeResponsibleParty) {
      const responsible = ticket.assigned_profile?.full_name || 'Not Assigned'
      this.addFieldSection('Responsible Party', responsible)
    }

    // Target Date (optional)
    if (options.samaFields.includeTargetDate && ticket.due_date) {
      this.addFieldSection('Target Completion Date', format(new Date(ticket.due_date), 'MMM dd, yyyy'))
    }

    // All comments/activities (optional)
    if (options.includeAllComments && ticket.audit_comments && ticket.audit_comments.length > 0) {
      this.doc.moveDown(0.5)
      this.doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Discussion History:')
        .moveDown(0.3)

      ticket.audit_comments.forEach((comment: any) => {
        const author = comment.profiles?.full_name || 'Unknown'
        const date = format(new Date(comment.created_at), 'MMM dd, yyyy')

        this.doc
          .fontSize(9)
          .font('Helvetica-Oblique')
          .fillColor('#666666')
          .text(`${author} - ${date}:`)
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#333333')
          .text(comment.content || '', {
            indent: 10
          })
          .moveDown(0.3)
      })
    }

    // Separator line
    this.doc
      .moveDown(0.5)
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .moveTo(this.MARGIN, this.doc.y)
      .lineTo(this.PAGE_WIDTH - this.MARGIN, this.doc.y)
      .stroke()
      .moveDown(0.5)
  }

  /**
   * Add a field section (label + content)
   */
  private addFieldSection(label: string, content: string): void {
    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#333333')
      .text(`${label}:`)
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#000000')
      .text(content, {
        width: this.CONTENT_WIDTH,
        align: 'justify',
        indent: 10,
        lineGap: 3
      })
      .moveDown(0.8)
  }

  /**
   * Add section header
   */
  private addSectionHeader(title: string): void {
    this.doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#1a56db')
      .text(title)
      .moveDown(1)
  }

  /**
   * Group tickets by specified field
   */
  private groupTickets(tickets: PdfTicket[], groupBy: string): Record<string, PdfTicket[]> {
    if (groupBy === 'none') {
      return { 'All Findings': tickets }
    }

    const grouped: Record<string, PdfTicket[]> = {}

    tickets.forEach(ticket => {
      const key = ticket[groupBy as keyof PdfTicket] as string || 'Other'
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(ticket)
    })

    return grouped
  }

  /**
   * Format group name for display
   */
  private formatGroupName(name: string, groupBy: string): string {
    if (groupBy === 'department') {
      return `Department: ${name}`
    } else if (groupBy === 'priority') {
      return `Priority: ${name.charAt(0).toUpperCase() + name.slice(1)}`
    } else if (groupBy === 'status') {
      return `Status: ${name.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
    }
    return name
  }

  /**
   * Get color for status
   */
  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      open: '#dc2626',
      in_progress: '#f59e0b',
      pending: '#3b82f6',
      closed: '#16a34a'
    }
    return colors[status] || '#6b7280'
  }

  /**
   * Get risk level from priority
   */
  private getRiskLevel(priority: string): string {
    const levels: Record<string, string> = {
      critical: 'Critical Risk - Requires Immediate Attention',
      high: 'High Risk - Requires Prompt Action',
      medium: 'Medium Risk - Requires Attention',
      low: 'Low Risk - Monitor and Address'
    }
    return levels[priority] || 'Risk level not specified'
  }

  /**
   * Add page numbers to all pages (except cover page)
   * CRITICAL: Fix the page count BEFORE looping to prevent infinite loops
   */
  private addPageNumbers(): void {
    const range = this.doc.bufferedPageRange()
    const totalPages = range.count
    const fixedPageCount = totalPages  // Store fixed count before loop

    // Start from page 1 (skip cover page which is page 0)
    // Use FIXED count, not totalPages which might change during loop
    for (let i = 1; i < fixedPageCount; i++) {
      this.doc.switchToPage(i)

      // Get current state
      const currentState = {
        x: this.doc.x,
        y: this.doc.y
      }

      // Write header - use absolute positioning
      const headerText = 'Audit Report - Internal Audit Department'
      this.doc.fontSize(9).fillColor('#666666').font('Helvetica')

      // Calculate center position for header
      const textWidth = this.doc.widthOfString(headerText)
      const headerX = (this.PAGE_WIDTH - textWidth) / 2

      this.doc.text(headerText, headerX, 30, {
        lineBreak: false,
        continued: false
      })

      // Restore state immediately
      this.doc.x = currentState.x
      this.doc.y = currentState.y

      // Write footer - use absolute positioning
      const footerText = `Page ${i} of ${fixedPageCount - 1}  |  Generated on ${format(new Date(), 'MMM dd, yyyy')}`
      this.doc.fontSize(9).fillColor('#666666').font('Helvetica')

      // Calculate center position for footer
      const footerWidth = this.doc.widthOfString(footerText)
      const footerX = (this.PAGE_WIDTH - footerWidth) / 2

      this.doc.text(footerText, footerX, this.PAGE_HEIGHT - 50, {
        lineBreak: false,
        continued: false
      })

      // Restore state immediately
      this.doc.x = currentState.x
      this.doc.y = currentState.y
    }
  }
}
