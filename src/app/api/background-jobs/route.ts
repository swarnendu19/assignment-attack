import { NextRequest, NextResponse } from 'next/server'
import { backgroundJobService } from '@/services/backgroundJobService'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobStatus = backgroundJobService.getJobStatus()
    return NextResponse.json({ jobs: jobStatus })
  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, jobName, isActive } = body

    switch (action) {
      case 'start':
        backgroundJobService.start()
        return NextResponse.json({ success: true, message: 'Background jobs started' })

      case 'stop':
        backgroundJobService.stop()
        return NextResponse.json({ success: true, message: 'Background jobs stopped' })

      case 'toggle':
        if (!jobName || isActive === undefined) {
          return NextResponse.json(
            { error: 'jobName and isActive are required for toggle action' },
            { status: 400 }
          )
        }
        backgroundJobService.setJobActive(jobName, isActive)
        return NextResponse.json({ 
          success: true, 
          message: `Job ${jobName} ${isActive ? 'enabled' : 'disabled'}` 
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use start, stop, or toggle' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error managing background jobs:', error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to manage background jobs' },
      { status: 500 }
    )
  }
}