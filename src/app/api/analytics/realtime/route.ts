import { NextRequest, NextResponse } from 'next/server'
import { analyticsService } from '@/services/analyticsService'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get real-time metrics for user's team
    const realTimeMetrics = await analyticsService.getRealTimeMetrics(session.user.teamId)

    return NextResponse.json({
      success: true,
      data: realTimeMetrics
    })

  } catch (error) {
    console.error('Real-time analytics API error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Enable caching for real-time metrics (short cache duration)
export const revalidate = 30 // Revalidate every 30 seconds