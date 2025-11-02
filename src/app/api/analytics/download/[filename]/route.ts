import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { auth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { filename } = params
    
    // Validate filename (security check)
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const filePath = path.join(process.cwd(), 'tmp', filename)

    try {
      // Check if file exists
      await fs.access(filePath)
      
      // Read file
      const fileBuffer = await fs.readFile(filePath)
      
      // Determine content type based on file extension
      const ext = path.extname(filename).toLowerCase()
      let contentType = 'application/octet-stream'
      
      switch (ext) {
        case '.csv':
          contentType = 'text/csv'
          break
        case '.pdf':
          contentType = 'application/pdf'
          break
        case '.json':
          contentType = 'application/json'
          break
      }

      // Return file with appropriate headers
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      })

    } catch (fileError) {
      // File not found or access error
      return NextResponse.json(
        { error: 'File not found or expired' },
        { status: 404 }
      )
    }

  } catch (error) {
    console.error('Analytics download API error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}