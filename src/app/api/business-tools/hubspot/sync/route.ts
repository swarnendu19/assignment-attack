import { NextRequest, NextResponse } from 'next/server'
import { businessToolsService } from '@/services/businessToolsService'
import { contactService } from '@/services/contactService'
import { auth } from '@/lib/auth'

/**
 * POST /api/business-tools/hubspot/sync
 * Sync contacts with HubSpot
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
    const { configId, contactIds, syncType = 'to_hubspot' } = body

    if (!configId) {
      return NextResponse.json({ error: 'Configuration ID is required' }, { status: 400 })
    }

    let results

    if (syncType === 'to_hubspot') {
      if (!contactIds || !Array.isArray(contactIds)) {
        return NextResponse.json({ error: 'Contact IDs are required for sync to HubSpot' }, { status: 400 })
      }

      results = await businessToolsService.bulkSyncToHubSpot(
        teamId,
        configId,
        contactIds,
        session.user.id
      )
    } else {
      return NextResponse.json({ error: 'Sync from HubSpot not yet implemented' }, { status: 400 })
    }

    const summary = {
      total: results.length,
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      errors: results.filter(r => r.action === 'error').length,
      skipped: results.filter(r => r.action === 'skipped').length,
    }

    return NextResponse.json({ 
      success: true,
      summary,
      results: results.slice(0, 10), // Return first 10 detailed results
      hasMore: results.length > 10
    })
  } catch (error) {
    console.error('Error syncing with HubSpot:', error)
    return NextResponse.json(
      { error: 'Failed to sync with HubSpot' },
      { status: 500 }
    )
  }
}