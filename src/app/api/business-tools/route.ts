import { NextRequest, NextResponse } from 'next/server'
import { businessToolsService } from '@/services/businessToolsService'
import { BusinessToolConfigSchema } from '@/types/business'
import { auth } from '@/lib/auth'

/**
 * GET /api/business-tools
 * Get all business tool configurations for the user's team
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's team ID (you'll need to implement this based on your auth system)
    const teamId = session.user.teamId
    if (!teamId) {
      return NextResponse.json({ error: 'No team associated with user' }, { status: 400 })
    }

    const configs = await businessToolsService.getBusinessToolConfigs(teamId)
    
    // Remove sensitive credentials from response
    const sanitizedConfigs = configs.map(config => ({
      ...config,
      credentials: Object.keys(config.credentials).reduce((acc, key) => {
        acc[key] = '***'
        return acc
      }, {} as Record<string, string>)
    }))

    return NextResponse.json({ configs: sanitizedConfigs })
  } catch (error) {
    console.error('Error fetching business tool configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch business tool configurations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/business-tools
 * Create a new business tool configuration
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
    const { configId, ...configData } = body

    if (!configId) {
      return NextResponse.json({ error: 'Configuration ID is required' }, { status: 400 })
    }

    // Validate the configuration data
    const validatedConfig = BusinessToolConfigSchema.parse(configData)

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

    return NextResponse.json({ config: sanitizedConfig }, { status: 201 })
  } catch (error) {
    console.error('Error creating business tool config:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid configuration data', details: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create business tool configuration' },
      { status: 500 }
    )
  }
}