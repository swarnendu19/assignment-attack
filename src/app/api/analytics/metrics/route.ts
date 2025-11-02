import { NextRequest, NextResponse } from 'next/server'
import { analyticsService } from '@/services/analyticsService'
import { AnalyticsQuerySchema } from '@/types/analytics'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    
    // Validate query parameters
    const query = AnalyticsQuerySchema.parse({
      ...body,
      dateRange: {
        startDate: new Date(body.dateRange.startDate),
        endDate: new Date(body.dateRange.endDate)
      },
      teamId: session.user.teamId // Use user's team ID
    })

    // Get analytics metrics
    const metrics = await analyticsService.getAnalyticsMetrics(query)

    return NextResponse.json({
      success: true,
      data: metrics
    })

  } catch (error) {
    console.error('Analytics metrics API error:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const channels = searchParams.get('channels')?.split(',')
    const userIds = searchParams.get('userIds')?.split(',')
    const granularity = searchParams.get('granularity') || 'day'
    const metrics = searchParams.get('metrics')?.split(',')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    // Validate and build query
    const query = AnalyticsQuerySchema.parse({
      dateRange: {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      channels: channels as any,
      userIds,
      teamId: session.user.teamId,
      granularity: granularity as any,
      metrics: metrics as any
    })

    // Get analytics metrics
    const analyticsMetrics = await analyticsService.getAnalyticsMetrics(query)

    return NextResponse.json({
      success: true,
      data: analyticsMetrics
    })

  } catch (error) {
    console.error('Analytics metrics GET API error:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}