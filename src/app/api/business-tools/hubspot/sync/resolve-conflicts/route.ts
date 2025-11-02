import { NextRequest, NextResponse } from 'next/server'
import { businessToolsService } from '@/services/businessToolsService'
import { SyncConflictResolutionSchema } from '@/types/business'
import { auth } from '@/lib/auth'

/**
 * POST /api/business-tools/hubspot/sync/resolve-conflicts
 * Resolve HubSpot sync conflicts
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teamId = session.user.teamId
    if (!teamId) {
      return NextResponse.json({ error: 'No team associated with user' }, { status: 400 })
    }

    const body = await request.json()
    const { configId, resolution } = body

    if (!configId) {
      return NextResponse.json({ error: 'Configuration ID is required' }, { status: 400 })
    }

    // Validate resolution data
    const validatedResolution = SyncConflictResolutionSchema.parse(resolution)

    const updatedContact = await businessToolsService.resolveHubSpotConflicts(
      teamId,
      configId,
      validatedResolution,
      session.user.id
    )

    return NextResponse.json({ 
      success: true,
      contact: updatedContact
    })
  } catch (error) {
    console.error('Error resolving HubSpot conflicts:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid resolution data', details: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to resolve conflicts' },
      { status: 500 }
    )
  }
}