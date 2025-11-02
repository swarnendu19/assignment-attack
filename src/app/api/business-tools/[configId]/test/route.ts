import { NextRequest, NextResponse } from 'next/server'
import { businessToolsService } from '@/services/businessToolsService'
import { auth } from '@/lib/auth'

/**
 * POST /api/business-tools/[configId]/test
 * Test connection for a business tool configuration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teamId = session.user.teamId
    if (!teamId) {
      return NextResponse.json({ error: 'No team associated with user' }, { status: 400 })
    }

    const { configId } = params

    const isConnected = await businessToolsService.testConnection(teamId, configId)

    return NextResponse.json({ 
      success: isConnected,
      message: isConnected ? 'Connection successful' : 'Connection failed'
    })
  } catch (error) {
    console.error('Error testing business tool connection:', error)
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to test connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}