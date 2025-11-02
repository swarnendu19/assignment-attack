import { NextRequest, NextResponse } from 'next/server'
import { businessToolsService } from '@/services/businessToolsService'
import { BusinessToolConfigSchema } from '@/types/business'
import { auth } from '@/lib/auth'

/**
 * PUT /api/business-tools/[configId]
 * Update a business tool configuration
 */
export async function PUT(
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
    const body = await request.json()

    // Validate the configuration data
    const validatedConfig = BusinessToolConfigSchema.parse(body)

    const config = await businessToolsService.saveBusinessToolConfig(
      teamId,
      configId,
      validatedConfig
    )

    // Remove sensitive credentials from response
    const sanitizedConfig = {
      ...config,
      credentials: Object.keys(config.credentials).reduce((acc, key) => {
        acc[key] = '***'
        return acc
      }, {} as Record<string, string>)
    }

    return NextResponse.json({ config: sanitizedConfig })
  } catch (error) {
    console.error('Error updating business tool config:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid configuration data', details: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update business tool configuration' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/business-tools/[configId]
 * Delete a business tool configuration
 */
export async function DELETE(
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

    await businessToolsService.deleteBusinessToolConfig(teamId, configId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting business tool config:', error)
    return NextResponse.json(
      { error: 'Failed to delete business tool configuration' },
      { status: 500 }
    )
  }
}