import { NextRequest, NextResponse } from 'next/server'
import { businessToolsService } from '@/services/businessToolsService'
import { auth } from '@/lib/auth'

/**
 * GET /api/business-tools/hubspot/sync/status
 * Get HubSpot sync status for all contacts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teamId = session.user.teamId
    if (!teamId) {
      return NextResponse.json({ error: 'No team associated with user' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const configId = searchParams.get('configId')

    if (!configId) {
      return NextResponse.json({ error: 'Configuration ID is required' }, { status: 400 })
    }

    const statuses = await businessToolsService.getHubSpotSyncStatuses(teamId, configId)

    const summary = {
      total: statuses.length,
      synced: statuses.filter(s => s.syncStatus === 'synced').length,
      pending: statuses.filter(s => s.syncStatus === 'pending').length,
      errors: statuses.filter(s => s.syncStatus === 'error').length,
      conflicts: statuses.filter(s => s.syncStatus === 'conflict').length,
    }

    return NextResponse.json({ 
      success: true,
      summary,
      statuses
    })
  } catch (error) {
    console.error('Error getting HubSpot sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}