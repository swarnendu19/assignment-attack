import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { userService } from '@/services/userService'
import { requireRole } from '@/lib/middleware'
import { UserRole } from '@prisma/client'

const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  settings: z.record(z.unknown()).optional(),
})

const updateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').optional(),
  settings: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const tokenData = await requireRole(request, UserRole.ADMIN)
    
    const body = await request.json()
    const { name, settings } = createTeamSchema.parse(body)

    const team = await userService.createTeam({
      name,
      settings,
    })

    return NextResponse.json({
      success: true,
      team,
    })
  } catch (error) {
    console.error('Create team error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Insufficient permissions') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const tokenData = await requireRole(request, UserRole.VIEWER)
    
    const team = await userService.getTeamById(tokenData.teamId)
    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ team })
  } catch (error) {
    console.error('Get team error:', error)
    
    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Insufficient permissions') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}