import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null

  try {
    // Get the uploaded file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only CSV and Excel files are supported.' },
        { status: 400 }
      )
    }

    // Create unique temp file path
    const fileExtension = path.extname(fileName)
    const uniqueFileName = `${randomUUID()}${fileExtension}`
    tempFilePath = path.join('/tmp', uniqueFileName)

    // Write file to temp location
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(tempFilePath, buffer)

    console.log(`[AI Classifier] Temp file created: ${tempFilePath}`)

    // Get the project root directory (scripts folder is at project root)
    const projectRoot = process.cwd()
    const scriptsPath = path.join(projectRoot, 'scripts')
    const venvPython = path.join(projectRoot, '.venv', 'bin', 'python3')

    // Check if we should use venv python or system python
    const pythonCommand = await execAsync(`test -f ${venvPython} && echo "venv" || echo "system"`)
      .then(({ stdout }) => stdout.trim() === 'venv' ? venvPython : 'python3')
      .catch(() => 'python3')

    console.log(`[AI Classifier] Using Python: ${pythonCommand}`)
    console.log(`[AI Classifier] Running classifier on: ${tempFilePath}`)

    // Execute Python classifier
    const { stdout, stderr } = await execAsync(
      `cd ${scriptsPath} && ${pythonCommand} run_classifier.py ${tempFilePath}`,
      {
        timeout: 120000, // 2 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    )

    if (stderr) {
      console.warn('[AI Classifier] Python stderr:', stderr)
    }

    console.log('[AI Classifier] Python stdout (first 500 chars):', stdout.substring(0, 500))

    // Parse the output JSON file
    const outputJsonPath = tempFilePath.replace(/\.(csv|xlsx|xls)$/, '_classification_results.json')

    console.log(`[AI Classifier] Reading results from: ${outputJsonPath}`)

    // Read the classification results
    const { readFile } = await import('fs/promises')
    const resultsJson = await readFile(outputJsonPath, 'utf-8')
    const results = JSON.parse(resultsJson)

    console.log('[AI Classifier] Classification complete:', {
      totalColumns: results.statistics?.total_columns,
      columnsClassified: results.statistics?.columns_classified,
      rowsProcessed: results.statistics?.total_rows_processed,
    })

    // Clean up temp files
    await unlink(tempFilePath).catch(err => console.warn('Failed to delete temp file:', err))
    await unlink(outputJsonPath).catch(err => console.warn('Failed to delete results file:', err))

    return NextResponse.json({
      success: true,
      column_mapping: results.column_mapping,
      column_classifications: results.column_classifications,
      department_classifications: results.department_classifications,
      processed_tickets: results.processed_tickets,
      statistics: results.statistics,
      file_summary: results.file_summary,
    })

  } catch (error) {
    console.error('[AI Classifier] Error:', error)

    // Clean up temp file on error
    if (tempFilePath) {
      await unlink(tempFilePath).catch(() => {})
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'AI classification failed',
          details: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred during AI classification' },
      { status: 500 }
    )
  }
}